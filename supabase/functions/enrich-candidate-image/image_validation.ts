// Phase 1.8c.6-A.2 — shared page-owned image validator + resolver.
//
// Used by:
//   - merge.ts success path (page-owned image overrides Gemini image)
//   - page_metadata_fallback.ts (consistent definition of a valid page image)
//
// Pure function — no I/O. Privacy-safe: never logs URLs.

/**
 * Patterns that indicate an image is not a usable product/entity image
 * (1x1 tracking pixels, favicons, beacons, transparent gifs, etc.).
 * Matched case-insensitively against the full absolute URL.
 */
const TRACKING_OR_PLACEHOLDER_PATTERNS: RegExp[] = [
  /\/1x1\./i,
  /pixel\.(gif|png|jpe?g)/i,
  /\/tracking?\//i,
  /\/track\//i,
  /\/beacon\b/i,
  /\/transparent\.(gif|png)/i,
  /\/favicon\b/i,
  /\.ico(\?|$)/i,
  /\/spacer\.(gif|png)/i,
  /\/blank\.(gif|png)/i,
];

/**
 * Returns true if `value` is a usable absolute http(s) image URL that
 * does not match known tracking pixel / favicon / placeholder patterns.
 *
 * Inputs are expected to already be absolute (extractor and Firecrawl
 * helpers both resolve relative URLs upstream). Any malformed, non-http,
 * data:, blob:, javascript:, or empty value returns false.
 */
export function isValidPageImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s) return false;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const full = u.href;
  for (const p of TRACKING_OR_PLACEHOLDER_PATTERNS) {
    if (p.test(full)) return false;
  }
  return true;
}

export type PageOwnedImageSource = "extractor" | "firecrawl";

export interface PageOwnedImage {
  url: string;
  source: PageOwnedImageSource;
}

/**
 * Resolve the highest-priority page-owned image:
 *   1. extractor image (`extract.image_url`)
 *   2. Firecrawl metadata image (`flags.firecrawlImageUrl`)
 *   3. null
 *
 * Each candidate must pass `isValidPageImageUrl`. Returns null when no
 * candidate qualifies.
 */
export function resolvePageOwnedImage(args: {
  extractImageUrl?: string | null;
  firecrawlImageUrl?: string | null;
}): PageOwnedImage | null {
  if (isValidPageImageUrl(args.extractImageUrl)) {
    return { url: args.extractImageUrl as string, source: "extractor" };
  }
  if (isValidPageImageUrl(args.firecrawlImageUrl)) {
    return { url: args.firecrawlImageUrl as string, source: "firecrawl" };
  }
  return null;
}
