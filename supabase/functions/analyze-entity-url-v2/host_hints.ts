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
