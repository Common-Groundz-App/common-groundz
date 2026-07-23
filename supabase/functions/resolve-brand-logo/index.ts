// v8e — Brand logo lookup for Search-to-Draft rows.
//
// POST { brand: string } → { logoUrl, source, cached, skipReason? }
//
// Reuses the same Google CSE pipeline URL Analysis already uses
// (findOfficialBrandWebsite + searchBrandLogoV2). URL Analysis files are
// NOT modified — we only import from analyze-entity-url-v2/brand_logo_lookup.ts.
// The four filter helpers (normalize/reject/accept/tryOwnOriginFavicon) are
// parity-copied into ./logo_filters.ts to keep this function self-contained
// from a runtime standpoint.
//
// Auth: bearer + auth.getClaims (mirrors search-entity-candidates).
// Flag: entity_extraction.search_brand_logo_lookup_enabled (admin bypass).
// Rate limit: in-memory per-instance, 30 lookups/user/rolling-hour.
// Cache: in-memory Map keyed by normalized brand, 24h TTL (positive+negative).
// Logging: brandHashPrefix only. Never log raw brand text or full URLs.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { isSearchBrandLogoLookupEnabled } from "../_shared/feature_flags.ts";
import {
  findOfficialBrandWebsite,
  searchBrandLogoV2,
} from "./brand_logo_lookup.ts";
import {
  normalizeLogoUrl,
  isRejectedLogoUrl,
  isAcceptableLogo,
  tryOwnOriginFavicon,
} from "./logo_filters.ts";
import {
  normalizeBrand,
  checkRateLimit as pureCheckRateLimit,
  buildFlagOffResponse,
  buildRateLimitedResponse,
} from "./helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUDGET_MS = 4_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const BodySchema = z.object({ brand: z.string().min(1).max(120) });

type LogoSource = "google_images" | "favicon" | "none";
interface LookupResult {
  logoUrl: string | null;
  source: LogoSource;
  skipReason?: string;
}

// ─── Per-instance cache ──────────────────────────────────────────────────
interface CacheEntry { result: LookupResult; expiresAt: number }
const logoCache = new Map<string, CacheEntry>();

// ─── Per-instance rate limit (userId → hits with timestamps) ─────────────
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const hits = rateBuckets.get(userId) ?? [];
  if (!pureCheckRateLimit(userId, hits, now)) {
    // Keep only recent hits so bucket doesn't grow unbounded.
    rateBuckets.set(userId, hits.filter((t) => t > now - 60 * 60 * 1000));
    return false;
  }
  const recent = hits.filter((t) => t > now - 60 * 60 * 1000);
  recent.push(now);
  rateBuckets.set(userId, recent);
  return true;
}

async function brandHashPrefix(normalized: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(buf));
  return arr.slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logEvent(event: string, fields: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ event, ...fields }));
  } catch { /* ignore */ }
}

async function lookupLogo(brand: string, hashPrefix: string): Promise<LookupResult> {
  const apiKey = Deno.env.get("GOOGLE_CUSTOM_SEARCH_API_KEY") ?? "";
  const cxId = Deno.env.get("GOOGLE_CUSTOM_SEARCH_CX") ?? "";
  if (!apiKey || !cxId) {
    logEvent("resolve_brand_logo", {
      brandHashPrefix: hashPrefix, ok: false, source: "none",
      phase: "config", ms: 0, cached: false, skipReason: "no_google_creds",
    });
    return { logoUrl: null, source: "none", skipReason: "no_google_creds" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BUDGET_MS);
  const t0 = Date.now();

  try {
    // Step 1: official website
    let websiteUrl: string | null = null;
    try {
      websiteUrl = await findOfficialBrandWebsite(brand, apiKey, cxId, controller.signal);
    } catch { /* swallow */ }

    // Step 2: logo image via Google CSE, filtered through URL-Analyze parity pipeline
    const filterPipeline = (raw: string): string | null => {
      const n = normalizeLogoUrl(raw);
      if (!n) return null;
      if (isRejectedLogoUrl(n)) return null;
      if (!isAcceptableLogo(n, websiteUrl, "google_images")) return null;
      return n;
    };

    let logoUrl: string | null = null;
    let source: LogoSource = "none";
    let phase: string = "none";

    if (!controller.signal.aborted) {
      try {
        const res = await searchBrandLogoV2(
          brand, websiteUrl, apiKey, cxId, controller.signal, filterPipeline,
        );
        if (res.url) {
          logoUrl = res.url;
          source = "google_images";
          phase = res.phase;
        }
      } catch { /* swallow */ }
    }

    // Step 3: own-origin favicon fallback
    if (!logoUrl && websiteUrl && !controller.signal.aborted) {
      try {
        const fav = await tryOwnOriginFavicon(websiteUrl, controller.signal);
        if (fav) {
          logoUrl = fav;
          source = "favicon";
          phase = "favicon";
        }
      } catch { /* swallow */ }
    }

    const ms = Date.now() - t0;
    logEvent("resolve_brand_logo", {
      brandHashPrefix: hashPrefix, ok: !!logoUrl, source,
      phase, ms, cached: false,
    });
    return { logoUrl, source };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResp({ error: "method_not_allowed" }, 405);

  try {
    // ─── Auth (in-code JWT check) ─────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return jsonResp({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    // ─── Flag + admin bypass ──────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    const isAdmin = isAdminData === true;

    if (!isAdmin) {
      const enabled = await isSearchBrandLogoLookupEnabled(supabaseAdmin);
      if (!enabled) {
        return jsonResp({ logoUrl: null, source: "none", cached: false, skipReason: "flag_off" });
      }
    }

    // ─── Input validation ─────────────────────────────────────────────
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResp({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const brand = parsed.data.brand.trim();
    if (brand.length === 0) return jsonResp({ error: "invalid_brand" }, 400);

    const normalized = normalizeBrand(brand);
    if (!normalized) {
      return jsonResp({ logoUrl: null, source: "none", cached: false, skipReason: "invalid_brand" });
    }
    const hashPrefix = await brandHashPrefix(normalized);

    // ─── Cache lookup ─────────────────────────────────────────────────
    const now = Date.now();
    const cached = logoCache.get(normalized);
    if (cached && cached.expiresAt > now) {
      logEvent("resolve_brand_logo", {
        brandHashPrefix: hashPrefix, ok: !!cached.result.logoUrl,
        source: cached.result.source, phase: "cache", ms: 0, cached: true,
        skipReason: cached.result.skipReason,
      });
      return jsonResp({ ...cached.result, cached: true });
    }

    // ─── Rate limit (post-cache to keep cached rows free) ─────────────
    if (!checkRateLimit(userId)) {
      logEvent("resolve_brand_logo", {
        brandHashPrefix: hashPrefix, ok: false, source: "none",
        phase: "ratelimit", ms: 0, cached: false, skipReason: "rate_limited",
      });
      return jsonResp({ logoUrl: null, source: "none", cached: false, skipReason: "rate_limited" });
    }

    // ─── Do the lookup ────────────────────────────────────────────────
    const result = await lookupLogo(brand, hashPrefix);
    logoCache.set(normalized, { result, expiresAt: now + CACHE_TTL_MS });

    return jsonResp({ ...result, cached: false });
  } catch (e) {
    console.error("[resolve-brand-logo] unexpected:", (e as Error).message);
    return jsonResp({ logoUrl: null, source: "none", cached: false, skipReason: "internal_error" });
  }
});
