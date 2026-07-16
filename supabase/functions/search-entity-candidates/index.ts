// Phase 3.5a — Search-to-Draft.
//
// Text query → internal DB fuzzy match + Gemini Google Search grounding
// → up to 5 EntityDraft candidates. Never writes. Never touches the URL
// analyze pipeline (analyze-entity-url-v2 etc).
//
// This function mirrors the proven-working grounded-search pattern used by
// `smart-assistant/index.ts` (webFallbackSearch) and
// `analyze-entity-url-v2/gemini.ts`. It calls Google's public REST
// `generateContent` endpoint with `tools: [{ google_search: {} }]` on
// `gemini-1.5-flash`. Newer models (`gemini-2.5-flash`, `gemini-3.5-flash`)
// are documented for grounding but consistently timed out on this path in
// our deployment — they can be A/B tested via the `GEMINI_GROUNDED_MODEL`
// env override without a redeploy.
//
// `responseMimeType` / `responseSchema` are intentionally NOT set: Google
// REST returns 400 "Search Grounding can't be used with JSON/YAML/XML mode"
// when either is combined with the `google_search` tool. We rely on prompt
// discipline + tolerant JSON extraction (extractJsonObject).
//
// Compliance / safety:
//   - `searchEntryPoint.renderedContent` is NEVER logged raw. Only
//     { hasSearchEntryPoint, renderedContentLength, renderedContentHash }.
//   - Raw attribution HTML is returned in `diagnostics.groundingAttribution`
//     ONLY when the caller is an admin. Frontend never renders it in 3.5a.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isNonAdminEntityCreationEnabled,
  isNonAdminSearchToDraftEnabled,
} from "../_shared/feature_flags.ts";
import {
  ENTITY_DRAFT_SCHEMA_VERSION,
  type EntityDraft,
} from "../_shared/contracts/entityDraft.types.ts";
import { validateEntityDraft } from "../_shared/contracts/entityDraft.schema.ts";
import { normalizeBrandName } from "../_shared/brand_normalize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_GEMINI_GROUNDED_MODEL = "gemini-1.5-flash";
const GEMINI_TIMEOUT_MS = Number(Deno.env.get("GEMINI_TIMEOUT_MS")) || 20_000;
const HOURLY_LIMIT = 20;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

// ---------- helpers ----------

type EntityTypeLiteral =
  | "product" | "brand" | "place" | "book"
  | "movie" | "food" | "app" | "tv";

const ALLOWED_TYPES: readonly EntityTypeLiteral[] = [
  "product", "brand", "place", "book", "movie", "food", "app", "tv",
];

interface GeminiCandidateRaw {
  name?: unknown;
  type?: unknown;
  brand?: unknown;
  variant?: unknown;
  category?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  sourceUrl?: unknown;
  sourceTitle?: unknown;
  confidence?: unknown;
}

interface ExistingMatch {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  type: string;
}

interface GroundingSource { title: string; domain: string }

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeQuery(raw: string): string {
  return raw.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function safeDomain(url: string | null | undefined): string {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

function isString(v: unknown, min = 1, max = 2000): v is string {
  return typeof v === "string" && v.length >= min && v.length <= max;
}

async function sha256Hex12(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

// Balanced-brace tolerant JSON extractor. Strips markdown fences, finds
// the first top-level {...} block, tries JSON.parse. Returns null on failure.
function extractJsonObject(raw: string): unknown | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const first = stripped.indexOf("{");
  if (first === -1) return null;

  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = first; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = stripped.slice(first, i + 1);
        try { return JSON.parse(slice); } catch { return null; }
      }
    }
  }
  return null;
}

function coerceCandidate(c: GeminiCandidateRaw): {
  name: string; type: EntityTypeLiteral; brand: string | null;
  variant: string | null; category: string | null; description: string;
  imageUrl: string | null; sourceUrl: string; sourceTitle: string | null;
  confidence: number;
} | null {
  if (!isString(c.name, 1, 300)) return null;
  const typeRaw = typeof c.type === "string" ? c.type.trim().toLowerCase() : "";
  if (!ALLOWED_TYPES.includes(typeRaw as EntityTypeLiteral)) return null;
  if (!isString(c.sourceUrl, 8, 2048)) return null;
  try { new URL(c.sourceUrl as string); } catch { return null; }

  let confidence = typeof c.confidence === "number" ? c.confidence : 0.5;
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));

  const brand = isString(c.brand, 1, 200) ? (c.brand as string).trim() : null;
  const variant = isString(c.variant, 1, 200) ? (c.variant as string).trim() : null;
  const category = isString(c.category, 1, 200) ? (c.category as string).trim() : null;
  const description = isString(c.description, 1, 2000) ? (c.description as string).trim() : "";
  const imageUrl = isString(c.imageUrl, 8, 2048) ? (c.imageUrl as string).trim() : null;
  const sourceTitle = isString(c.sourceTitle, 1, 400) ? (c.sourceTitle as string).trim() : null;

  return {
    name: (c.name as string).trim(),
    type: typeRaw as EntityTypeLiteral,
    brand, variant, category, description,
    imageUrl, sourceUrl: (c.sourceUrl as string).trim(),
    sourceTitle, confidence,
  };
}

function buildDraft(
  candidate: NonNullable<ReturnType<typeof coerceCandidate>>,
  originalQuery: string,
): EntityDraft | null {
  const domain = safeDomain(candidate.sourceUrl);
  const brandCandidates = candidate.brand
    ? [{
        name: candidate.brand,
        source: "google_grounding" as const,
        confidence: candidate.confidence,
        status: "suggested_new" as const,
      }]
    : [];
  const imageCandidates = candidate.imageUrl
    ? [{
        url: candidate.imageUrl,
        source: "google_grounding" as const,
        confidence: candidate.confidence,
      }]
    : [];

  const structuredHints: Record<string, unknown> = {
    // Full untruncated URL — used later for tracing / display.
    sourceUrl: candidate.sourceUrl,
    displayDomain: domain,
  };
  if (candidate.variant) structuredHints.variant = candidate.variant;
  if (candidate.category) structuredHints.category = candidate.category;
  if (candidate.sourceTitle) structuredHints.sourceTitle = candidate.sourceTitle;

  const draft: EntityDraft = {
    schemaVersion: ENTITY_DRAFT_SCHEMA_VERSION,
    inputMethod: "search",
    inputRef: originalQuery.slice(0, 512),
    nameGuess: candidate.name,
    typeGuess: candidate.type,
    descriptionGuess: candidate.description || undefined,
    structuredHints,
    brandCandidates,
    imageCandidates,
    sourceEvidence: [{
      field: "name",
      // Short + sanitized display value (schema caps at 200).
      value: (domain || candidate.sourceUrl).slice(0, 200),
      source: "google_grounding",
      confidence: candidate.confidence,
    }],
  };

  try {
    return validateEntityDraft(draft);
  } catch (e) {
    console.warn("[search-entity-candidates] draft validation failed:", (e as Error).message);
    return null;
  }
}

// ---------- Phase 3.5c — conservative candidate dedup ----------
//
// Collapse only STRONG duplicates. Never collapse legitimate variants
// (size, formulation, edition, product line).
//
// Rules (any one triggers a collapse):
//   1) Same normalized full URL (host + pathname, query/fragment stripped).
//   2) Same normalized brand + name + variant.
//   3) Same normalized brand + exact-equal normalized name, ONLY when both
//      sides have no variant. If either has a variant, do NOT collapse.
//
// Merge behavior: keep the highest-confidence winner; if tied, keep the
// earlier one (Gemini order). Merge groundingSources domains (dedup by
// hostname). Keep winner's imageUrl.

type Coerced = NonNullable<ReturnType<typeof coerceCandidate>>;

function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFKD")
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeFullUrl(u: string): string {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch { return u.toLowerCase(); }
}

function dedupKeysFor(c: Coerced): string[] {
  const keys: string[] = [`url:${normalizeFullUrl(c.sourceUrl)}`];
  const brand = c.brand ? normalizeBrandName(c.brand) : "";
  const name = normalizeName(c.name);
  const variant = c.variant ? normalizeName(c.variant) : "";
  if (brand && name && variant) {
    keys.push(`bnv:${brand}|${name}|${variant}`);
  }
  if (brand && name && !variant) {
    // Only when BOTH sides have no variant. Encoded so the same-brand+name
    // pair with a variant on either side cannot collide with this key.
    keys.push(`bn0:${brand}|${name}`);
  }
  return keys;
}

function conservativeDedup(list: Coerced[]): Coerced[] {
  if (list.length <= 1) return list;
  // Preserve original index for stable ordering on ties.
  const withIndex = list.map((c, i) => ({ c, i }));

  const keyToGroup = new Map<string, number>();
  const groups: { winner: Coerced; winnerIdx: number; keys: Set<string> }[] = [];

  for (const { c, i } of withIndex) {
    const keys = dedupKeysFor(c);
    let target = -1;
    for (const k of keys) {
      const g = keyToGroup.get(k);
      if (g !== undefined) { target = g; break; }
    }
    if (target === -1) {
      const g = { winner: c, winnerIdx: i, keys: new Set(keys) };
      const gid = groups.push(g) - 1;
      for (const k of keys) keyToGroup.set(k, gid);
    } else {
      const g = groups[target];
      // Higher confidence wins; tie → earlier index (already the current winner).
      if (c.confidence > g.winner.confidence) {
        g.winner = c;
        g.winnerIdx = i;
      }
      for (const k of keys) {
        if (!g.keys.has(k)) {
          g.keys.add(k);
          keyToGroup.set(k, target);
        }
      }
    }
  }

  // Return winners in their original (Gemini) order.
  return groups
    .slice()
    .sort((a, b) => a.winnerIdx - b.winnerIdx)
    .map((g) => g.winner);
}

// ---------- in-memory cache ----------


interface CacheEntry {
  candidates: unknown[];        // client-safe draft candidates
  groundingSources: GroundingSource[];
  hasSearchEntryPoint: boolean;
  renderedContentAdmin: string | null;
  storedAt: number;
}
const cache = new Map<string, CacheEntry>();

function cachePut(key: string, entry: CacheEntry) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, entry);
}
function cacheGet(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU ordering.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

// ---------- Gemini call ----------

async function callGemini(
  apiKey: string,
  model: string,
  query: string,
  typeHint: string | undefined,
): Promise<{
  candidates: NonNullable<ReturnType<typeof coerceCandidate>>[];
  groundingSources: GroundingSource[];
  hasSearchEntryPoint: boolean;
  renderedContentLength: number;
  renderedContentHash: string | null;
  rawRenderedContent: string | null;
  errorCode: null | "grounding_unavailable" | "parse_failed" | "timeout";
}> {
  const geminiStart = Date.now();
  const prompt = [
    `User query: "${query}"`,
    `Type hint: "${typeHint ?? "unknown"}"`,
    "",
    "Return up to 5 distinct real-world entity candidates the user likely means.",
    "Return fewer if only fewer are strongly supported by grounded results.",
    "Do not invent extra variants just to fill the list.",
    "Rules:",
    "- JSON only. No prose. No markdown fences.",
    "- Prefer specific products/items over category/brand landing pages.",
    "- Distinct variants (size, formulation, edition) are distinct candidates.",
    "- Do not invent. If unsure, lower the confidence rather than guess.",
    "- Cite the primary source URL for each candidate.",
    "",
    "Schema:",
    `{ "candidates": [{`,
    `  "name": string, "type": "product|brand|place|book|movie|food|app|tv",`,
    `  "brand": string|null, "variant": string|null,`,
    `  "description": string, "imageUrl": string|null,`,
    `  "sourceUrl": string, "confidence": number`,
    `}] }`,
  ].join("\n");

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
      candidateCount: 1,
      // responseMimeType / responseSchema INTENTIONALLY OMITTED — Google REST
      // returns 400 "Search Grounding can't be used with JSON/YAML/XML mode"
      // when either is combined with tools: [{ google_search: {} }]. We rely
      // on prompt discipline + extractJsonObject() for tolerant parsing (same
      // pattern as smart-assistant webFallbackSearch and analyze-entity-url-v2).
    },
  };

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let raw: any;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => "");
      console.warn(
        `[search-entity-candidates] Gemini HTTP ${resp.status}: ${bodyText.slice(0, 500)}`,
      );
      return {
        candidates: [], groundingSources: [], hasSearchEntryPoint: false,
        renderedContentLength: 0, renderedContentHash: null,
        rawRenderedContent: null, errorCode: "grounding_unavailable",
      };
    }
    raw = await resp.json();
  } catch (e) {
    clearTimeout(timer);
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"));
    const errorCode: "timeout" | "grounding_unavailable" = isAbort ? "timeout" : "grounding_unavailable";
    console.warn(
      `[search-entity-candidates] Gemini call failed:`,
      JSON.stringify({
        model,
        timeoutMs: GEMINI_TIMEOUT_MS,
        errorCode,
        isAbort,
        message: (e as Error).message,
        latencyMs: Date.now() - geminiStart,
      }),
    );
    return {
      candidates: [], groundingSources: [], hasSearchEntryPoint: false,
      renderedContentLength: 0, renderedContentHash: null,
      rawRenderedContent: null, errorCode,
    };
  }

  const parts: any[] = raw?.candidates?.[0]?.content?.parts ?? [];
  const textOut = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("\n")
    .trim();

  const groundingMetadata = raw?.candidates?.[0]?.groundingMetadata ?? {};
  const renderedContent: string | null =
    typeof groundingMetadata?.searchEntryPoint?.renderedContent === "string"
      ? groundingMetadata.searchEntryPoint.renderedContent
      : null;

  const groundingSources: GroundingSource[] = Array.isArray(groundingMetadata?.groundingChunks)
    ? groundingMetadata.groundingChunks
        .map((c: any) => {
          const uri = c?.web?.uri || "";
          return {
            title: typeof c?.web?.title === "string" ? c.web.title : "",
            domain: safeDomain(uri),
          };
        })
        .filter((s: GroundingSource) => s.domain)
        .slice(0, 10)
    : [];

  const parsed = extractJsonObject(textOut);
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).candidates)) {
    console.warn(
      `[search-entity-candidates] parse_failed:`,
      JSON.stringify({
        model,
        latencyMs: Date.now() - geminiStart,
        textOutLength: textOut.length,
        hasSearchEntryPoint: !!renderedContent,
        errorCode: "parse_failed",
      }),
    );
    return {
      candidates: [], groundingSources,
      hasSearchEntryPoint: !!renderedContent,
      renderedContentLength: renderedContent?.length ?? 0,
      renderedContentHash: renderedContent ? await sha256Hex12(renderedContent) : null,
      rawRenderedContent: renderedContent,
      errorCode: "parse_failed",
    };
  }

  // Phase 3.5c — coerce up to 8 raw candidates, then conservatively dedup,
  // then cap at 5. Dedup gets the wider pool so obvious duplicates from
  // multiple domains collapse before hitting the 5-candidate ceiling.
  const rawCoerced: NonNullable<ReturnType<typeof coerceCandidate>>[] = [];
  for (const c of (parsed as any).candidates.slice(0, 8)) {
    const ok = coerceCandidate(c);
    if (ok) rawCoerced.push(ok);
  }
  const coerced = conservativeDedup(rawCoerced).slice(0, 5);

  return {
    candidates: coerced,
    groundingSources,
    hasSearchEntryPoint: !!renderedContent,
    renderedContentLength: renderedContent?.length ?? 0,
    renderedContentHash: renderedContent ? await sha256Hex12(renderedContent) : null,
    rawRenderedContent: renderedContent,
    errorCode: null,
  };
}

// ---------- handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  try {
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
    const userId = claimsData.claims.sub;

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
      const [creationEnabled, searchEnabled] = await Promise.all([
        isNonAdminEntityCreationEnabled(supabaseAdmin),
        isNonAdminSearchToDraftEnabled(supabaseAdmin),
      ]);
      if (!creationEnabled || !searchEnabled) {
        return jsonResp({ error: "search_disabled" }, 403);
      }
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonResp({ error: "search_not_configured" }, 500);

    const body = (await req.json().catch(() => ({}))) as {
      query?: string; typeHint?: string;
    };
    const rawQuery = typeof body.query === "string" ? body.query : "";
    const normalized = normalizeQuery(rawQuery);
    if (normalized.length < 3 || normalized.length > 160) {
      return jsonResp({ error: "invalid_query" }, 400);
    }
    const typeHint = typeof body.typeHint === "string" && body.typeHint.trim().length > 0
      ? body.typeHint.trim() : undefined;

    // Rate limit (atomic).
    const { data: rateCount, error: rateErr } = await supabaseAdmin.rpc(
      "increment_search_rate_limit", { _user_id: userId },
    );
    if (rateErr) {
      console.warn("[search-entity-candidates] rate rpc failed:", rateErr.message);
    } else if (typeof rateCount === "number" && rateCount > HOURLY_LIMIT) {
      const nextHour = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000);
      const retryAfterSeconds = Math.max(1, Math.round((nextHour.getTime() - Date.now()) / 1000));
      return jsonResp({ error: "rate_limited", retryAfterSeconds }, 429);
    }

    // Opportunistic prune (~1% of calls).
    if (Math.random() < 0.01) {
      supabaseAdmin.rpc("prune_search_rate_limits").catch(() => {});
    }

    const model = Deno.env.get("GEMINI_GROUNDED_MODEL") || DEFAULT_GEMINI_GROUNDED_MODEL;
    const cacheKey = `${model}|${typeHint ?? ""}|${normalized}`;

    // ─── Internal fuzzy DB match (always fresh, even on cache hit).
    // Uses direct ILIKE via service role so RLS never hides an existing
    // entity from the search result.
    const firstWord = normalized.split(/\s+/)[0] ?? normalized;
    let internalQuery = supabaseAdmin
      .from("entities")
      .select("id, name, slug, image_url, type")
      .eq("is_deleted", false)
      .neq("approval_status", "rejected");
    if (typeHint && ALLOWED_TYPES.includes(typeHint as EntityTypeLiteral)) {
      internalQuery = internalQuery.eq("type", typeHint as any);
    }
    const { data: internalRows } = await internalQuery
      .ilike("name", `%${firstWord}%`)
      .limit(5);

    const existingMatches: ExistingMatch[] = (internalRows ?? []).map((r: any) => ({
      id: r.id, name: r.name, slug: r.slug ?? null,
      imageUrl: r.image_url ?? null, type: r.type,
    }));

    // ─── External (cache hit shortcut).
    const cached = cacheGet(cacheKey);
    if (cached) {
      const diagnostics: Record<string, unknown> = {
        model, groundingUsed: true, cached: true,
        latencyMs: Date.now() - started,
        warnings: [],
        groundingSources: cached.groundingSources,
        hasSearchEntryPoint: cached.hasSearchEntryPoint,
      };
      if (isAdmin && cached.renderedContentAdmin) {
        diagnostics.groundingAttribution = cached.renderedContentAdmin;
      }
      return jsonResp({
        existingMatches,
        candidates: cached.candidates,
        diagnostics,
      });
    }

    // ─── Fresh Gemini call.
    const gemini = await callGemini(apiKey, model, normalized, typeHint);
    // Log safe metadata only — never renderedContent itself.
    console.log(
      "[search-entity-candidates] gemini",
      JSON.stringify({
        model,
        candidates: gemini.candidates.length,
        groundingSources: gemini.groundingSources.length,
        hasSearchEntryPoint: gemini.hasSearchEntryPoint,
        renderedContentLength: gemini.renderedContentLength,
        renderedContentHash: gemini.renderedContentHash,
        errorCode: gemini.errorCode,
        latencyMs: Date.now() - started,
      }),
    );

    const draftCandidates: unknown[] = [];
    for (const c of gemini.candidates) {
      const draft = buildDraft(c, rawQuery);
      if (draft) {
        draftCandidates.push({
          draft,
          candidate: {
            name: c.name, type: c.type, brand: c.brand,
            variant: c.variant, category: c.category,
            description: c.description, imageUrl: c.imageUrl,
            sourceUrl: c.sourceUrl, sourceTitle: c.sourceTitle,
            displayDomain: safeDomain(c.sourceUrl),
            confidence: c.confidence,
          },
        });
      }
    }

    // Only cache when we actually got usable candidates and no hard error.
    if (!gemini.errorCode && draftCandidates.length > 0) {
      cachePut(cacheKey, {
        candidates: draftCandidates,
        groundingSources: gemini.groundingSources,
        hasSearchEntryPoint: gemini.hasSearchEntryPoint,
        renderedContentAdmin: gemini.rawRenderedContent,
        storedAt: Date.now(),
      });
    }

    const diagnostics: Record<string, unknown> = {
      model,
      groundingUsed: !gemini.errorCode,
      cached: false,
      latencyMs: Date.now() - started,
      warnings: [],
      groundingSources: gemini.groundingSources,
      hasSearchEntryPoint: gemini.hasSearchEntryPoint,
    };
    if (gemini.errorCode) diagnostics.errorCode = gemini.errorCode;
    if (isAdmin && gemini.rawRenderedContent) {
      diagnostics.groundingAttribution = gemini.rawRenderedContent;
    }

    return jsonResp({
      existingMatches,
      candidates: draftCandidates,
      diagnostics,
    });
  } catch (err: any) {
    console.error("[search-entity-candidates] fatal:", err?.message ?? err);
    return jsonResp({ error: "internal_error", detail: err?.message }, 500);
  }
});
