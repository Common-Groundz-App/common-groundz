// Phase 3.5b — Selected-candidate image enrichment.
//
// Called on-demand when a user clicks "Review & create" on a web search
// candidate that has no image. Fetches the candidate's sourceUrl HTML,
// extracts a page-owned image (og:image, twitter:image, JSON-LD image, etc.),
// and returns it so the Draft Review modal can prepend it to the image grid.
//
// STRICT boundaries:
// - SSRF-safe: source URL, every redirect target, and the extracted image
//   URL all pass through `assertSafeUrl`.
// - Cache checked BEFORE rate limit. Hits never consume quota.
// - Total server time budget ~6s. Client caps at 6.5s.
// - Never blocks review: any failure returns imageUrl=null; frontend opens
//   Draft Review regardless.
// - Privacy: logs only host/method/latency/errorCode/cached — never full URL,
//   never HTML, never query strings.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isNonAdminEntityCreationEnabled,
  isNonAdminSearchToDraftEnabled,
  isSearchImageFirecrawlEnabled,
} from "../_shared/feature_flags.ts";
import { assertSafeUrl, SsrfError } from "./ssrf.ts";
import { isValidPageImageUrl } from "./image_validation.ts";
import {
  extractSoftRedirectTarget,
  normalizeForCompare,
  type SoftRedirectKind,
} from "./soft_redirect.ts";
// v8b — Firecrawl fallback. Imported in-place from analyze-entity-url-v2 to
// keep that pipeline's helper untouched.
import {
  runFirecrawlScrape,
  NORMAL_FIRECRAWL_API_TIMEOUT_MS,
  NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS,
} from "./firecrawl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---- budgets ----
const TOTAL_BUDGET_MS = 6_000;
// v8b.1 — extra budget headroom when Firecrawl fallback is enabled for a
// Firecrawl-only host (~11s total: 6s base + 5s extra).
const FIRECRAWL_EXTRA_BUDGET_MS = 5_000;
// v8b.1 — Firecrawl-only hosts (Google/Vertex interstitials that need JS
// rendering). Keep in EXACT sync with FIRECRAWL_ONLY_HOSTS_FE in
// src/components/admin/entity-create/SearchEntryPanel.tsx.
const FIRECRAWL_ONLY_HOSTS = new Set([
  "vertexaisearch.cloud.google.com",
]);
const PAGE_FETCH_TIMEOUT_MS = 4_000;
const IMAGE_PROBE_TIMEOUT_MS = 1_500;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 512 * 1024;
const HOURLY_LIMIT = 60;

// ---- cache ----
type ExtractMethod = "og" | "twitter" | "image_src" | "json_ld" | "firecrawl_metadata";
type ErrorCode =
  | "timeout"
  | "blocked"
  | "no_image"
  | "unsafe_url"
  | "invalid_content_type"
  | "rate_limited";

interface CachedResult {
  imageUrl: string | null;
  source: "page_metadata" | "firecrawl" | null;
  method: ExtractMethod | null;
  errorCode?: ErrorCode;
}
interface CacheEntry {
  result: CachedResult;
  expiresAt: number;
}
const CACHE_MAX = 300;
const cache = new Map<string, CacheEntry>();
function cacheGet(key: string): CachedResult | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  // refresh LRU
  cache.delete(key);
  cache.set(key, e);
  return e.result;
}
function cachePut(key: string, result: CachedResult, ttlMs: number) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { result, expiresAt: Date.now() + ttlMs });
}
function ttlFor(result: CachedResult): number | null {
  if (result.imageUrl) return 60 * 60 * 1000; // 60 min positive
  switch (result.errorCode) {
    case "no_image":
      return 20 * 60 * 1000;
    case "unsafe_url":
    case "invalid_content_type":
      return 60 * 60 * 1000;
    // timeout / blocked / rate_limited -> not cached (transient)
    default:
      return null;
  }
}

// ---- helpers ----
function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Normalize source URL to a stable cache key: lowercase host, strip fragment
 * and common tracking params. */
function normalizeCacheKey(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    const strip = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid",
    ];
    for (const p of strip) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return null;
  }
}

/** Fetch with total timeout, manual redirects (SSRF-checked per hop),
 *  body size cap. Returns null string on any handled failure via throw. */
async function safeFetchHtml(
  startUrl: string,
  totalDeadline: number,
): Promise<{ finalUrl: string; html: string }> {
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // SSRF-check every hop.
    const safe = await assertSafeUrl(currentUrl);
    currentUrl = safe.url;

    const remaining = totalDeadline - Date.now();
    if (remaining <= 200) throw new Error("timeout");
    const perHopTimeout = Math.min(PAGE_FETCH_TIMEOUT_MS, remaining - 100);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perHopTimeout);
    let resp: Response;
    try {
      resp = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (compatible; CommonGroundzBot/1.0; +https://common-groundz.lovable.app/bot)",
        },
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "AbortError" || e.message?.includes("aborted"))) {
        throw new Error("timeout");
      }
      throw new Error("blocked");
    } finally {
      clearTimeout(timer);
    }

    // Manual redirect handling.
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      // consume body to free connection
      try { await resp.arrayBuffer(); } catch { /* noop */ }
      if (!loc) throw new Error("no_image");
      if (hop >= MAX_REDIRECTS) throw new Error("blocked");
      // Resolve relative redirects against the current absolute URL.
      let nextUrl: string;
      try { nextUrl = new URL(loc, currentUrl).toString(); }
      catch { throw new Error("unsafe_url"); }
      currentUrl = nextUrl;
      continue;
    }

    if (!resp.ok) throw new Error("no_image");

    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      throw new Error("no_image");
    }

    // Read body with cap. Slurp then substring — HTML is bounded above by 512KB.
    let html: string;
    try {
      const reader = resp.body?.getReader();
      if (!reader) {
        html = await resp.text();
      } else {
        let received = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            received += value.byteLength;
            if (received > MAX_BODY_BYTES) {
              try { await reader.cancel(); } catch { /* noop */ }
              break;
            }
            chunks.push(value);
          }
        }
        // Concatenate.
        const total = chunks.reduce((n, c) => n + c.byteLength, 0);
        const merged = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
        html = new TextDecoder("utf-8", { fatal: false }).decode(merged);
      }
    } catch {
      throw new Error("no_image");
    }
    // We only need the head; truncate to first 256KB to speed regex.
    if (html.length > 256_000) html = html.slice(0, 256_000);
    return { finalUrl: currentUrl, html };
  }
  throw new Error("blocked");
}

// ---- extraction ----
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findMetaContent(html: string, property: string): string | null {
  // Handles both name="..." and property="..." with either attribute order.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${property}["'][^>]*content\\s*=\\s*["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]*(?:property|name)\\s*=\\s*["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function findLinkImageSrc(html: string): string | null {
  const patterns = [
    /<link[^>]+rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']image_src["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function findJsonLdImage(html: string): string | null {
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const url = pickJsonLdImage(parsed);
      if (url) return url;
    } catch {
      // Not valid JSON — skip.
    }
  }
  return null;
}
function pickJsonLdImage(node: unknown): string | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const u = pickJsonLdImage(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const img = obj["image"];
  if (typeof img === "string" && img.length > 0) return img;
  if (Array.isArray(img)) {
    for (const it of img) {
      if (typeof it === "string" && it.length > 0) return it;
      if (it && typeof it === "object") {
        const url = (it as Record<string, unknown>).url;
        if (typeof url === "string" && url.length > 0) return url;
      }
    }
  }
  if (img && typeof img === "object") {
    const url = (img as Record<string, unknown>).url;
    if (typeof url === "string" && url.length > 0) return url;
  }
  // Recurse a bit into common containers.
  for (const key of ["mainEntity", "@graph"]) {
    const child = obj[key];
    if (child) {
      const u = pickJsonLdImage(child);
      if (u) return u;
    }
  }
  return null;
}

// v7 — narrow logo/banner/icon filter. Rejects only when a pathname
// segment or filename matches (case-insensitive) — NOT arbitrary substrings.
// `/brands/cetaphil/cleanser.jpg` passes; `/assets/brand-logo.png` rejected.
const LOGO_SEGMENTS = new Set([
  "logo", "logos", "site-logo", "brand-logo", "brand_logo", "brand-banner",
  "header", "banner", "sprite", "placeholder", "favicon", "icon",
  "default", "avatar",
]);
function looksLikeLogoOrBanner(imgUrl: string): boolean {
  try {
    const u = new URL(imgUrl);
    const segs = u.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
    if (segs.length === 0) return false;
    const last = segs[segs.length - 1];
    // Reject .svg on the file (usually vector logos/icons).
    if (/\.svg(\?|$)/i.test(last)) return true;
    // Filename stem match (strip extension + query).
    const stem = last.replace(/\.[a-z0-9]+$/i, "");
    for (const bad of LOGO_SEGMENTS) {
      if (stem === bad || stem.includes(bad)) return true;
    }
    // Any earlier segment exact-match (e.g. `/img/logo/foo.png`).
    for (let i = 0; i < segs.length - 1; i++) {
      if (LOGO_SEGMENTS.has(segs[i])) return true;
    }
    // Special `brand/header` two-segment pattern.
    for (let i = 0; i < segs.length - 1; i++) {
      if (segs[i] === "brand" && (segs[i + 1] === "header" || segs[i + 1] === "banner")) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// v7 — JSON-LD-first candidate ladder. Collect all four candidates, drop
// those failing basic validity or the logo/banner filter, return the first
// survivor. Order: JSON-LD → OG → Twitter → image_src.
function extractImage(html: string): { url: string; method: ExtractMethod } | null {
  const candidates: Array<{ url: string; method: ExtractMethod }> = [];
  const ld = findJsonLdImage(html);
  if (ld) candidates.push({ url: ld, method: "json_ld" });
  const og = findMetaContent(html, "og:image:secure_url") ??
    findMetaContent(html, "og:image");
  if (og) candidates.push({ url: og, method: "og" });
  const tw = findMetaContent(html, "twitter:image") ??
    findMetaContent(html, "twitter:image:src");
  if (tw) candidates.push({ url: tw, method: "twitter" });
  const linkSrc = findLinkImageSrc(html);
  if (linkSrc) candidates.push({ url: linkSrc, method: "image_src" });
  for (const c of candidates) {
    if (!isValidPageImageUrl(c.url)) continue;
    if (looksLikeLogoOrBanner(c.url)) continue;
    return c;
  }
  return null;
}

/** Best-effort image content-type HEAD probe. */
async function probeImageContentType(
  url: string,
  deadline: number,
): Promise<boolean> {
  const remaining = deadline - Date.now();
  if (remaining <= 100) return true; // budget spent; trust extension/URL
  const perTimeout = Math.min(IMAGE_PROBE_TIMEOUT_MS, remaining - 50);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), perTimeout);
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    // If server rejects HEAD, treat as OK (many CDNs 405 on HEAD).
    if (resp.status === 405 || resp.status === 501) return true;
    if (resp.status >= 300 && resp.status < 400) return true; // don't chase image redirects for probe
    if (!resp.ok) return false;
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    return ct.startsWith("image/");
  } catch {
    return true; // treat probe failure as inconclusive → keep the image
  } finally {
    clearTimeout(timer);
  }
}

// ---- handler ----
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  // v8b — deadline is computed after we know the firecrawl flag (below).
  let deadline = started + TOTAL_BUDGET_MS;
  let host = "";
  let method: ExtractMethod | null = null;
  let cached = false;
  let firecrawlEnabled = false;

  try {
    // 1. Auth.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 2. Flag gate (admin bypasses).
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
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

    // v8b.1 — read Firecrawl flag here; deadline is extended below only
    // when the source URL is on a Firecrawl-only host.
    firecrawlEnabled = await isSearchImageFirecrawlEnabled(supabaseAdmin);


    // 3. Validate input.
    const body = (await req.json().catch(() => ({}))) as {
      sourceUrl?: string;
      name?: string;
    };
    const sourceUrlRaw = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (sourceUrlRaw.length < 8 || sourceUrlRaw.length > 2048) {
      return jsonResp({ error: "invalid_input" }, 400);
    }
    if (name.length < 1 || name.length > 200) {
      return jsonResp({ error: "invalid_input" }, 400);
    }
    const cacheKey = normalizeCacheKey(sourceUrlRaw);
    if (!cacheKey) return jsonResp({ error: "invalid_input" }, 400);
    host = safeHost(cacheKey);
    // v8b.1 — fast-path flag: only extend deadline & skip direct fetch when
    // both the Firecrawl flag is ON and the host is Firecrawl-only.
    const isFirecrawlOnlyHost = firecrawlEnabled && FIRECRAWL_ONLY_HOSTS.has(host);
    if (isFirecrawlOnlyHost) {
      deadline = started + TOTAL_BUDGET_MS + FIRECRAWL_EXTRA_BUDGET_MS;
    }
    // v8b.1 — bump cache prefix so v8b negative entries don't shadow the
    // new eligibility/skip behavior. Original cacheKey is preserved for
    // URL parsing/fetching.
    const cacheMapKey = firecrawlEnabled ? `v8b1|${cacheKey}` : cacheKey;

    // 4. Cache lookup BEFORE rate limit.
    const cachedResult = cacheGet(cacheMapKey);
    if (cachedResult) {
      cached = true;
      method = cachedResult.method;
      const latencyMs = Date.now() - started;
      // v8a — cache-hit telemetry reflects cached outcome (positive OR negative).
      const finalOutcome: string = cachedResult.imageUrl
        ? "success"
        : (cachedResult.errorCode ?? "no_image");
      console.log(JSON.stringify({
        event: "enrich_candidate_image",
        host,
        cached: true,
        finalOutcome,
        winningAttempt: "cache",
        winningMethod: cachedResult.method,
        totalLatencyMs: latencyMs,
        attempts: [],
      }));
      return jsonResp({
        imageUrl: cachedResult.imageUrl,
        source: cachedResult.source,
        method: cachedResult.method,
        diagnostics: {
          latencyMs,
          fetched: false,
          cached: true,
          ...(cachedResult.errorCode ? { errorCode: cachedResult.errorCode } : {}),
        },
      });
    }


    // 5. Rate limit (only on cache miss).
    const { data: rateCount, error: rateErr } = await supabaseAdmin.rpc(
      "increment_image_enrich_rate_limit",
      { _user_id: userId },
    );
    if (rateErr) {
      console.warn("[enrich-candidate-image] rate rpc failed:", rateErr.message);
    } else if (typeof rateCount === "number" && rateCount > HOURLY_LIMIT) {
      const latencyMs = Date.now() - started;
      console.log(JSON.stringify({
        event: "enrich_candidate_image",
        host,
        cached: false,
        finalOutcome: "rate_limited",
        winningAttempt: null,
        winningMethod: null,
        totalLatencyMs: latencyMs,
        attempts: [],
      }));

      return jsonResp({
        imageUrl: null, source: null, method: null,
        diagnostics: { latencyMs, fetched: false, cached: false, errorCode: "rate_limited" },
      }, 429);
    }

    // Opportunistic prune.
    if (Math.random() < 0.01) {
      supabaseAdmin.rpc("prune_image_enrich_rate_limits").catch(() => {});
    }

    // 6. v8a — split attempt flow so soft-redirect can see the HTML.
    //    Ladder (all share the 6 s deadline + same rate-limit unit):
    //      1. fetch original URL
    //      2. extract image from HTML          → success (winningAttempt="direct")
    //      3. extract soft-redirect target,
    //         SSRF-check, one hop, extract     → success (winningAttempt="soft_redirect")
    //      4. clean-URL retry (existing v7 rule) → success (winningAttempt="clean_url_retry")
    //      5. return no_image (or worst error).

    type AttemptKind = "direct" | "soft_redirect" | "clean_url_retry" | "firecrawl";
    type FirecrawlReason = "resolved_ok" | "resolved_no_image" | "unresolved_interstitial";
    interface AttemptTelemetry {
      kind: AttemptKind;
      errorCode: ErrorCode | null;
      method: ExtractMethod | null;
      latencyMs: number;
      softRedirectKind: SoftRedirectKind | null;
      /** v8b.1 — set on the synthetic "direct" entry for Firecrawl-only hosts. */
      skipped?: boolean;
      skipReason?: string;
      /** v8b.1 — set on Firecrawl attempts. */
      firecrawlReason?: FirecrawlReason;
    }
    interface FetchOk { finalUrl: string; html: string; }
    interface FetchErr { errorCode: ErrorCode; }

    const fetchHtmlAttempt = async (
      url: string,
    ): Promise<FetchOk | FetchErr> => {
      try {
        return await safeFetchHtml(url, deadline);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        let errorCode: ErrorCode;
        if (e instanceof SsrfError) errorCode = "unsafe_url";
        else if (msg === "timeout") errorCode = "timeout";
        else if (msg === "no_image") errorCode = "no_image";
        else if (msg === "unsafe_url") errorCode = "unsafe_url";
        else errorCode = "blocked";
        return { errorCode };
      }
    };

    /** Given already-fetched HTML, extract → resolve → SSRF-check → probe. */
    const extractImageFromHtml = async (
      finalUrl: string,
      html: string,
    ): Promise<CachedResult> => {
      const found = extractImage(html);
      if (!found) {
        return { imageUrl: null, source: null, method: null, errorCode: "no_image" };
      }
      let absImg: string;
      try { absImg = new URL(found.url, finalUrl).toString(); }
      catch {
        return { imageUrl: null, source: null, method: found.method, errorCode: "no_image" };
      }
      if (!isValidPageImageUrl(absImg) || looksLikeLogoOrBanner(absImg)) {
        return { imageUrl: null, source: null, method: found.method, errorCode: "no_image" };
      }
      try {
        await assertSafeUrl(absImg);
      } catch (e) {
        if (e instanceof SsrfError) {
          return { imageUrl: null, source: null, method: found.method, errorCode: "unsafe_url" };
        }
        return { imageUrl: null, source: null, method: found.method, errorCode: "no_image" };
      }
      const okType = await probeImageContentType(absImg, deadline);
      if (!okType) {
        return {
          imageUrl: null, source: null, method: found.method,
          errorCode: "invalid_content_type",
        };
      }
      return { imageUrl: absImg, source: "page_metadata", method: found.method };
    };

    const attempts: AttemptTelemetry[] = [];
    let winningAttempt: AttemptKind | null = null;
    let result: CachedResult = {
      imageUrl: null, source: null, method: null, errorCode: "no_image",
    };

    // Step 1 + 2 — direct fetch.
    const originalNormForCompare = normalizeForCompare(cacheKey);
    let originalFinalUrl: string | null = null;
    let originalHtml: string | null = null;
    {
      const t0 = Date.now();
      const fetched = await fetchHtmlAttempt(cacheKey);
      if ("errorCode" in fetched) {
        attempts.push({
          kind: "direct", errorCode: fetched.errorCode, method: null,
          latencyMs: Date.now() - t0, softRedirectKind: null,
        });
        result = { imageUrl: null, source: null, method: null, errorCode: fetched.errorCode };
      } else {
        originalFinalUrl = fetched.finalUrl;
        originalHtml = fetched.html;
        const extracted = await extractImageFromHtml(fetched.finalUrl, fetched.html);
        attempts.push({
          kind: "direct",
          errorCode: extracted.errorCode ?? null,
          method: extracted.method,
          latencyMs: Date.now() - t0,
          softRedirectKind: null,
        });
        result = extracted;
        if (extracted.imageUrl) winningAttempt = "direct";
      }
    }

    // Step 3 — soft-redirect fallback (only if we have HTML from step 1 and no image yet).
    if (!winningAttempt && originalHtml && originalFinalUrl && (deadline - Date.now()) >= 1500) {
      const target = extractSoftRedirectTarget(originalFinalUrl, originalHtml);
      if (target) {
        const targetNorm = normalizeForCompare(target.target);
        const finalUrlNorm = normalizeForCompare(originalFinalUrl);
        const selfRef =
          !targetNorm ||
          targetNorm === originalNormForCompare ||
          targetNorm === finalUrlNorm;
        if (!selfRef) {
          const t0 = Date.now();
          let softErr: ErrorCode | null = null;
          try {
            await assertSafeUrl(target.target);
          } catch {
            softErr = "unsafe_url";
          }
          if (softErr) {
            attempts.push({
              kind: "soft_redirect", errorCode: softErr, method: null,
              latencyMs: Date.now() - t0, softRedirectKind: target.kind,
            });
          } else {
            const fetched2 = await fetchHtmlAttempt(target.target);
            if ("errorCode" in fetched2) {
              attempts.push({
                kind: "soft_redirect", errorCode: fetched2.errorCode, method: null,
                latencyMs: Date.now() - t0, softRedirectKind: target.kind,
              });
            } else {
              const extracted2 = await extractImageFromHtml(fetched2.finalUrl, fetched2.html);
              attempts.push({
                kind: "soft_redirect",
                errorCode: extracted2.errorCode ?? null,
                method: extracted2.method,
                latencyMs: Date.now() - t0,
                softRedirectKind: target.kind,
              });
              if (extracted2.imageUrl) {
                result = extracted2;
                winningAttempt = "soft_redirect";
              }
            }
          }
        }
      }
    }

    // Step 4 — clean-URL retry (v7 rule, unchanged).
    if (!winningAttempt) {
      const shouldRetry =
        (result.errorCode === "no_image" || result.errorCode === "invalid_content_type") &&
        (() => {
          try { return new URL(cacheKey).search.length > 0; } catch { return false; }
        })() &&
        (deadline - Date.now()) >= 1500;
      if (shouldRetry) {
        let stripped: string | null = null;
        try {
          const u = new URL(cacheKey);
          u.search = "";
          stripped = u.toString();
        } catch { stripped = null; }
        if (stripped && stripped !== cacheKey) {
          const t0 = Date.now();
          const fetched3 = await fetchHtmlAttempt(stripped);
          if ("errorCode" in fetched3) {
            attempts.push({
              kind: "clean_url_retry", errorCode: fetched3.errorCode, method: null,
              latencyMs: Date.now() - t0, softRedirectKind: null,
            });
          } else {
            const extracted3 = await extractImageFromHtml(fetched3.finalUrl, fetched3.html);
            attempts.push({
              kind: "clean_url_retry",
              errorCode: extracted3.errorCode ?? null,
              method: extracted3.method,
              latencyMs: Date.now() - t0,
              softRedirectKind: null,
            });
            if (extracted3.imageUrl) {
              result = extracted3;
              winningAttempt = "clean_url_retry";
            }
          }
        }
      }
    }

    // Step 5 — v8b Firecrawl fallback (flag-gated). Last resort for pages
    // that need JS rendering (e.g. Google/Vertex interstitials). URL parsing
    // and fetching still use the original cacheKey; only the cache map key
    // is versioned so we don't reuse pre-v8b negative entries.
    if (
      !winningAttempt &&
      firecrawlEnabled &&
      (result.errorCode === "no_image" ||
       result.errorCode === "blocked" ||
       result.errorCode === "timeout" ||
       result.errorCode === "invalid_content_type") &&
      (deadline - Date.now()) >= 1500
    ) {
      const t0 = Date.now();
      let fcErrorCode: ErrorCode | null = null;
      let fcMethod: ExtractMethod | null = null;
      try {
        const remaining = deadline - Date.now();
        const apiTimeoutMs = Math.min(
          NORMAL_FIRECRAWL_API_TIMEOUT_MS,
          Math.max(1_500, remaining - 500),
        );
        const localTimeoutMs = Math.min(
          NORMAL_FIRECRAWL_LOCAL_TIMEOUT_MS,
          Math.max(1_800, remaining - 200),
        );
        const fc = await runFirecrawlScrape(cacheKey, {
          apiTimeoutMs,
          timeoutMs: localTimeoutMs,
          fallbackBaseUrl: cacheKey,
        });
        if (!fc.ok) {
          fcErrorCode = fc.code === "FIRECRAWL_TIMEOUT" ? "timeout" : "blocked";
        } else {
          // Try HTML extraction first.
          let extractedFc: CachedResult | null = null;
          if (fc.html) {
            const ex = await extractImageFromHtml(fc.finalUrl, fc.html);
            if (ex.imageUrl) {
              extractedFc = { ...ex, source: "firecrawl" };
              fcMethod = ex.method;
            }
          }
          // Fallback to Firecrawl metadata (og:image / image fields).
          if (!extractedFc && fc.metadata) {
            const md = fc.metadata as Record<string, unknown>;
            const raw =
              (typeof md.ogImage === "string" && md.ogImage) ||
              (typeof md["og:image"] === "string" && md["og:image"] as string) ||
              (typeof md.image === "string" && md.image) ||
              null;
            if (raw) {
              let absImg: string | null = null;
              try { absImg = new URL(raw, fc.finalUrl).toString(); } catch { absImg = null; }
              if (absImg && isValidPageImageUrl(absImg) && !looksLikeLogoOrBanner(absImg)) {
                try {
                  await assertSafeUrl(absImg);
                  const okType = await probeImageContentType(absImg, deadline);
                  if (okType) {
                    extractedFc = {
                      imageUrl: absImg,
                      source: "firecrawl",
                      method: "firecrawl_metadata",
                    };
                    fcMethod = "firecrawl_metadata";
                  }
                } catch { /* ssrf → skip */ }
              }
            }
          }
          if (extractedFc?.imageUrl) {
            result = extractedFc;
            winningAttempt = "firecrawl";
          } else {
            fcErrorCode = "no_image";
          }
        }
      } catch (e) {
        // Firecrawl-specific errors stay in telemetry only.
        fcErrorCode = "blocked";
        console.warn("[enrich-candidate-image] firecrawl threw:", (e as Error).message);
      }
      attempts.push({
        kind: "firecrawl",
        errorCode: winningAttempt === "firecrawl" ? null : fcErrorCode,
        method: fcMethod,
        latencyMs: Date.now() - t0,
        softRedirectKind: null,
      });
    }

    method = result.method ?? method;

    // 7. Cache per policy.
    const ttl = ttlFor(result);
    if (ttl) cachePut(cacheMapKey, result, ttl);

    const latencyMs = Date.now() - started;
    const finalOutcome: string = result.imageUrl
      ? "success"
      : (result.errorCode ?? "no_image");
    console.log(JSON.stringify({
      event: "enrich_candidate_image",
      host,
      cached: false,
      firecrawlEnabled,
      finalOutcome,
      winningAttempt,
      winningMethod: result.method,
      totalLatencyMs: latencyMs,
      attempts,
    }));

    return jsonResp({
      imageUrl: result.imageUrl,
      source: result.source,
      method: result.method,
      diagnostics: {
        latencyMs,
        fetched: true,
        cached: false,
        ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      },
    });

  } catch (err) {
    const latencyMs = Date.now() - started;
    console.error("[enrich-candidate-image] unhandled:", (err as Error).message);
    return jsonResp({
      imageUrl: null, source: null, method: null,
      diagnostics: { latencyMs, fetched: false, cached: false, errorCode: "blocked" as ErrorCode },
    }, 200);
  }
});
