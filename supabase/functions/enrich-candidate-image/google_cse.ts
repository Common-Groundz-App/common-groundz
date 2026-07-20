// v8c — Google Custom Search Images fallback for enrich-candidate-image.
//
// Used ONLY for Vertex interstitial rows (vertexaisearch.cloud.google.com)
// when the CSE fallback flag is ON. Reuses the existing project secrets
// GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_CX (already used
// by enrich-brand-data, fetch-url-metadata-lite, and analyze-entity-url-v2).
//
// Privacy: raw query text is NEVER logged. Callers receive only a short
// sha256 prefix (queryHashPrefix) suitable for correlating repeats.

// ---- constants exported for scoring ----

export const GENERIC_NAME_STOPWORDS = new Set<string>([
  "product",
  "products",
  "serum",
  "cream",
  "lotion",
  "cleanser",
  "gel",
  "toner",
  "mask",
  "spray",
  "roll",
  "on",
  "kit",
  "set",
  "pack",
  "bundle",
  "for",
  "with",
  "the",
  "and",
  "de",
  "la",
  "el",
  "new",
  "original",
  "refill",
]);

/** Image-mirror / marketplace-spam hosts. Results whose `contextLink` is on
 *  one of these hosts receive a scoring penalty. */
export const LOW_TRUST_CONTEXT_HOSTS = new Set<string>([
  "pinterest.com",
  "www.pinterest.com",
  "in.pinterest.com",
  "aliexpress.com",
  "dhgate.com",
  "alibaba.com",
  "ebay.com",
  "poshmark.com",
  "mercari.com",
  "etsy.com",
]);

// ---- module-level state (per-instance, resets on cold start) ----

interface CseCacheEntry {
  items: CseImageItem[];
  quotaThrottled: boolean;
  httpStatus: number | null;
  errorReason: string | null;
  expiresAt: number;
}

const CACHE_MAX = 500;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const cache = new Map<string, CseCacheEntry>();

const DAILY_LIMIT = 90;
let cseDailyCount = 0;
let cseDailyResetAt = 0;
let cseDisabledUntil = 0;

function nowMs(): number {
  return Date.now();
}

function tickDailyBucket() {
  const now = nowMs();
  if (now >= cseDailyResetAt) {
    cseDailyCount = 0;
    // Reset at next UTC-ish 24h boundary from now.
    cseDailyResetAt = now + 24 * 60 * 60 * 1000;
  }
}

// ---- types ----

export interface CseImageItem {
  imageUrl: string;
  contextLink: string | null;
  title: string;
  snippet: string;
  mime: string | null;
  width: number | null;
  height: number | null;
}

export interface CseSearchResult {
  items: CseImageItem[];
  cached: boolean;
  quotaThrottled: boolean;
  queryHashPrefix: string;
  latencyMs: number;
  resultCount: number;
  httpStatus: number | null;
  errorReason: string | null;
}

export interface BuildCseQueryInput {
  name: string | null | undefined;
  brand?: string | null | undefined;
  variant?: string | null | undefined;
}

export interface BuildCseQueryResult {
  query: string | null;
  reason: "ok" | "no_usable_query";
}

// ---- helpers ----

const TOKEN_SPLIT = /[^a-z0-9]+/i;

function tokenize(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function isAlnum(s: string): boolean {
  return /[a-z0-9]/i.test(s);
}

/** Builds a CSE query prioritizing brand + name. Dedupes brand tokens that
 *  already appear in the name (case-insensitive). Falls back to name-only
 *  if brand is missing. Returns { query: null, reason: "no_usable_query" }
 *  if the sanitized query has fewer than 2 alphanumeric tokens. */
export function buildCseQuery(input: BuildCseQueryInput): BuildCseQueryResult {
  const name = (input.name ?? "").trim();
  const brand = (input.brand ?? "").trim();
  const variant = (input.variant ?? "").trim();

  const nameTokensLower = new Set(tokenize(name));
  const brandTokensFiltered = tokenize(brand).filter(
    (t) => !nameTokensLower.has(t),
  );
  const brandCleaned = brandTokensFiltered.join(" ");

  const parts = [name, brandCleaned, variant, "product"]
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let query = parts.join(" ").replace(/\s+/g, " ").trim();
  if (query.length > 128) query = query.slice(0, 128).trim();

  const alnumTokens = query
    .split(/\s+/)
    .filter((t) => t.length > 0 && isAlnum(t));

  if (alnumTokens.length < 2) {
    return { query: null, reason: "no_usable_query" };
  }
  return { query, reason: "ok" };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function cacheKeyFor(query: string): Promise<string> {
  const hex = await sha256Hex(query.trim().toLowerCase());
  return `v8c-cse|${hex.slice(0, 32)}`;
}

function cacheGet(key: string): CseCacheEntry | null {
  const e = cache.get(key);
  if (!e) return null;
  if (nowMs() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  // LRU refresh
  cache.delete(key);
  cache.set(key, e);
  return e;
}

function cachePut(key: string, entry: CseCacheEntry) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, entry);
}

// ---- kill switch (public) ----

export function isCseDisabled(): boolean {
  return nowMs() < cseDisabledUntil;
}

export function isCseQuotaExhausted(): boolean {
  tickDailyBucket();
  return cseDailyCount >= DAILY_LIMIT;
}

// ---- main entrypoint ----

export interface RunCseInput {
  query: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Single CSE image search call, no retry. Applies quota bucket + kill-switch. */
export async function runGoogleCseImageSearch(
  input: RunCseInput,
): Promise<CseSearchResult> {
  const t0 = nowMs();
  const timeoutMs = input.timeoutMs ?? 2_500;
  const fetchImpl = input.fetchImpl ?? fetch;
  const query = input.query;
  const queryHashPrefix = (await sha256Hex(query.trim().toLowerCase())).slice(
    0,
    8,
  );
  const key = await cacheKeyFor(query);

  // 1. Cache lookup.
  const hit = cacheGet(key);
  if (hit) {
    return {
      items: hit.items,
      cached: true,
      quotaThrottled: hit.quotaThrottled,
      queryHashPrefix,
      latencyMs: nowMs() - t0,
      resultCount: hit.items.length,
      httpStatus: hit.httpStatus,
      errorReason: hit.errorReason,
    };
  }

  // 2. Kill switches.
  if (isCseDisabled()) {
    return {
      items: [],
      cached: false,
      quotaThrottled: true,
      queryHashPrefix,
      latencyMs: nowMs() - t0,
      resultCount: 0,
      httpStatus: null,
      errorReason: "cse_disabled",
    };
  }
  tickDailyBucket();
  if (cseDailyCount >= DAILY_LIMIT) {
    return {
      items: [],
      cached: false,
      quotaThrottled: true,
      queryHashPrefix,
      latencyMs: nowMs() - t0,
      resultCount: 0,
      httpStatus: null,
      errorReason: "daily_limit_guard",
    };
  }

  const apiKey = Deno.env.get("GOOGLE_CUSTOM_SEARCH_API_KEY") ?? "";
  const cx = Deno.env.get("GOOGLE_CUSTOM_SEARCH_CX") ?? "";
  if (!apiKey || !cx) {
    // Missing config: treat as disabled for 10min to avoid retry storms.
    cseDisabledUntil = nowMs() + 10 * 60 * 1000;
    return {
      items: [],
      cached: false,
      quotaThrottled: true,
      queryHashPrefix,
      latencyMs: nowMs() - t0,
      resultCount: 0,
      httpStatus: null,
      errorReason: "missing_config",
    };
  }

  cseDailyCount += 1;

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "5");
  url.searchParams.set("safe", "active");
  url.searchParams.set("imgSize", "large");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let items: CseImageItem[] = [];
  let quotaThrottled = false;
  let httpStatus: number | null = null;
  let errorReason: string | null = null;
  let shouldCache = false;
  try {
    const resp = await fetchImpl(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });
    httpStatus = resp.status;

    if (resp.status === 429) {
      cseDisabledUntil = nowMs() + 10 * 60 * 1000;
      quotaThrottled = true;
      errorReason = "rate_limited";
      shouldCache = true;
    } else if (!resp.ok) {
      // Try to detect quotaExceeded per Google's error contract.
      try {
        const err = await resp.json();
        const reasons: string[] =
          (err?.error?.errors ?? []).map((e: any) => e?.reason).filter(Boolean);
        errorReason = reasons[0] ?? err?.error?.status ?? `http_${resp.status}`;
        if (reasons.includes("quotaExceeded") || reasons.includes("dailyLimitExceeded")) {
          cseDisabledUntil = nowMs() + 10 * 60 * 1000;
          quotaThrottled = true;
        }
      } catch {
        errorReason = `http_${resp.status}`;
      }
      shouldCache = quotaThrottled;
    } else {
      shouldCache = true;
      const body = await resp.json();
      const raw = Array.isArray(body?.items) ? body.items : [];
      items = raw
        .map((it: any): CseImageItem | null => {
          const imageUrl = typeof it?.link === "string" ? it.link : null;
          if (!imageUrl) return null;
          const image = it?.image ?? {};
          return {
            imageUrl,
            contextLink:
              typeof image?.contextLink === "string" ? image.contextLink : null,
            title: typeof it?.title === "string" ? it.title : "",
            snippet: typeof it?.snippet === "string" ? it.snippet : "",
            mime: typeof it?.mime === "string" ? it.mime : null,
            width:
              typeof image?.width === "number" ? image.width : null,
            height:
              typeof image?.height === "number" ? image.height : null,
          };
        })
        .filter((x: CseImageItem | null): x is CseImageItem => x !== null);
    }
  } catch (e) {
    // Timeout / network / abort — leave items empty and do not cache.
    errorReason = e instanceof DOMException && e.name === "AbortError"
      ? "timeout"
      : "network_error";
  } finally {
    clearTimeout(timer);
  }

  if (shouldCache) {
    cachePut(key, {
      items,
      quotaThrottled,
      httpStatus,
      errorReason,
      expiresAt: nowMs() + CACHE_TTL_MS,
    });
  }

  return {
    items,
    cached: false,
    quotaThrottled,
    queryHashPrefix,
    latencyMs: nowMs() - t0,
    resultCount: items.length,
    httpStatus,
    errorReason,
  };
}

/** Compute a short queryHashPrefix without running a search. Used for
 *  telemetry when we short-circuit (no_usable_query, quota_throttled,
 *  cse_disabled) before hitting the CSE API. */
export async function computeQueryHashPrefix(query: string): Promise<string> {
  return (await sha256Hex(query.trim().toLowerCase())).slice(0, 8);
}
