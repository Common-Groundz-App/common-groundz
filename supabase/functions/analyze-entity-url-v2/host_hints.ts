// Phase 6: known JS-heavy hosts that benefit from Firecrawl rendering.
//
// Diagnostic-only. Used to tag firecrawl.priority. Never gates whether
// Firecrawl runs — the trigger lives in index.ts.

const AMAZON_HOST_RE = /(^|\.)amazon\.[a-z.]+$/i;

const JS_HEAVY_HOST_PATTERNS: RegExp[] = [
  AMAZON_HOST_RE,                   // amazon.com, amazon.in, amazon.co.uk, ...
  /(^|\.)flipkart\.com$/i,
  /(^|\.)myntra\.com$/i,
  /(^|\.)nykaa\.com$/i,
  /(^|\.)ajio\.com$/i,
  /(^|\.)meesho\.com$/i,
];

export function isKnownJsHeavyHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return JS_HEAVY_HOST_PATTERNS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

// Strict Amazon host: optional single subdomain, then `amazon.<tld>` with an
// optional second-level TLD. Rejects lookalikes like `amazon.in.evil.com`
// (no labels allowed AFTER the amazon.<tld> suffix).
const STRICT_AMAZON_HOST_RE = /^(?:[a-z0-9-]+\.)?amazon\.[a-z]{2,}(?:\.[a-z]{2,})?$/i;

function isAmazonHost(hostname: string): boolean {
  return STRICT_AMAZON_HOST_RE.test(hostname);
}

const ASIN_RE = /^[A-Za-z0-9]{10}$/;

// Match /dp/<ASIN>[/...] or /gp/product/<ASIN>[/...] anywhere in path.
const AMAZON_ASIN_PATH_RE = /\/(?:dp|gp\/product)\/([A-Za-z0-9]{10})(?:\/|$)/i;

// Phase 1.6: ASIN-extraction regex. Adds /gp/aw/d/<ASIN> in addition to the
// two forms above. Used ONLY by extractAmazonAsin — canonicalizeAmazonUrl
// and sanitizeFallbackEvidenceUrl keep the narrower legacy regex to avoid
// altering their existing behavior.
const AMAZON_ASIN_EXTRACT_RE =
  /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Za-z0-9]{10})(?:\/|$)/i;

/**
 * Phase 1.6: extract the 10-char Amazon Standard Identification Number from
 * a product URL. Strict host check (reuses the same predicate as
 * canonicalizeAmazonUrl, so regional hosts like amazon.co.uk and
 * amazon.com.au work and lookalikes like amazon.in.evil.com are rejected).
 * Case-insensitive path match across /dp/, /gp/product/, and /gp/aw/d/.
 * ASIN normalized to uppercase. Returns null for non-Amazon, malformed, or
 * non-product URLs. Pure. Never throws.
 */
export function extractAmazonAsin(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isAmazonHost(u.hostname)) return null;
    const m = u.pathname.match(AMAZON_ASIN_EXTRACT_RE);
    if (!m) return null;
    const asin = m[1].toUpperCase();
    if (!ASIN_RE.test(asin)) return null;
    return asin;
  } catch {
    return null;
  }
}

/**
 * Phase A1: canonicalize messy Amazon product URLs to https://<host>/dp/<ASIN>/
 * for Gemini URL Context only. Amazon-only. Strict host match (rejects
 * lookalikes like amazon.in.evil.com). Strict 10-char alnum ASIN match.
 * ASIN normalized to uppercase. No query, no fragment. Pure. Never throws.
 * Non-Amazon / malformed / no-ASIN URLs are returned unchanged.
 */
export function canonicalizeAmazonUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!isAmazonHost(u.hostname)) return url;
    const m = u.pathname.match(AMAZON_ASIN_PATH_RE);
    if (!m) return url;
    const asin = m[1].toUpperCase();
    if (!ASIN_RE.test(asin)) return url;
    return `https://${u.hostname}/dp/${asin}/`;
  } catch {
    return url;
  }
}

/**
 * Phase A2: extract the human-readable slug segment that precedes /dp/<ASIN>
 * or /gp/product/<ASIN> in an Amazon URL. Returned as sanitized evidence for
 * the Gemini prompt only — NEVER logged, never put on response, DB, or trace.
 * Returns null for non-Amazon hosts, URLs with no slug, already-clean URLs,
 * malformed input, or pure-numeric / punctuation-only slugs.
 */
export function extractAmazonPathSlug(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isAmazonHost(u.hostname)) return null;
    const path = u.pathname;
    const m = path.match(AMAZON_ASIN_PATH_RE);
    if (!m) return null;
    const asinIdx = m.index ?? -1;
    if (asinIdx <= 0) return null;
    // Take everything before the /dp/ or /gp/product/ marker, drop leading slash.
    const before = path.slice(0, asinIdx).replace(/^\/+/, "").replace(/\/+$/, "");
    if (!before) return null;
    // The slug is the LAST segment before the ASIN marker.
    const segments = before.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    const lastSeg = segments[segments.length - 1];
    let decoded: string;
    try {
      decoded = decodeURIComponent(lastSeg);
    } catch {
      decoded = lastSeg;
    }
    // Sanitize: replace -/_ with spaces, drop chars outside [A-Za-z0-9 ],
    // collapse whitespace, cap at 120 chars.
    let cleaned = decoded.replace(/[-_]+/g, " ").replace(/[^A-Za-z0-9 ]+/g, " ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    if (cleaned.length === 0) return null;
    if (/^\d+$/.test(cleaned.replace(/\s+/g, ""))) return null;
    if (!/[A-Za-z]/.test(cleaned)) return null;
    if (cleaned.length > 120) cleaned = cleaned.slice(0, 120).trim();
    return cleaned;
  } catch {
    return null;
  }
}

// Hard cap for the sanitized fallback-evidence URL. Search-only fallback
// prompts must never carry messy URLs into the model.
const FALLBACK_URL_MAX_CHARS = 512;

/**
 * Phase 1: produce a sanitized URL safe to embed in the search-only fallback
 * prompt. Applied for ALL hosts (the fallback can run on non-Amazon URLs too,
 * where canonicalizeAmazonUrl is a no-op and would leak tracking params).
 *
 * Rules:
 *  - parse failure → null
 *  - protocol allowlist (defense in depth): only http(s) is permitted;
 *    javascript:, data:, file:, blob:, ftp:, custom schemes → null
 *  - strip username, password, search (query string), hash (fragment)
 *  - Amazon product URL with extractable ASIN → canonical https://<host>/dp/<ASIN>/
 *  - otherwise → `${url.origin}${url.pathname}`
 *  - enforce 512-char cap; over the cap → null (never truncate mid-path)
 *
 * Pure. Never throws.
 */
export function sanitizeFallbackEvidenceUrl(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.username = "";
  u.password = "";
  u.search = "";
  u.hash = "";
  let out: string;
  if (isAmazonHost(u.hostname)) {
    const m = u.pathname.match(AMAZON_ASIN_PATH_RE);
    if (m) {
      const asin = m[1].toUpperCase();
      if (ASIN_RE.test(asin)) {
        out = `https://${u.hostname}/dp/${asin}/`;
      } else {
        out = `${u.origin}${u.pathname}`;
      }
    } else {
      out = `${u.origin}${u.pathname}`;
    }
  } else {
    out = `${u.origin}${u.pathname}`;
  }
  if (out.length > FALLBACK_URL_MAX_CHARS) return null;
  return out;
}

