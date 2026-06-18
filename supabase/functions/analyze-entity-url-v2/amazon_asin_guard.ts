// Phase 1.6: Amazon ASIN exact-match grounding guard.
//
// Verifies that Gemini's EXTERNAL grounding metadata actually references
// the target Amazon ASIN (or its canonical /dp/<ASIN>/, /gp/product/<ASIN>/,
// /gp/aw/d/<ASIN>/ paths). Used to block "Plantmade-style" drift where
// Gemini + Google Search confidently return a similar-but-wrong product.
//
// Evidence policy — accept ONLY external grounding evidence:
//   - groundingChunks[*].web.uri
//   - groundingChunks[*].web.title
//   - urlContextMetadata[*].retrievedUrl
//
// Excluded (must never be passed in):
//   - prompt text
//   - our canonical URL hint
//   - webSearchQueries (echoes the ASIN we asked for)
//   - groundingSupports[*].segment.text (may be model-generated)
//   - the model's answer text
//   - any locally constructed strings
//
// On Amazon ASIN paths the guard fails CLOSED: missing/empty external
// grounding evidence rejects with AMAZON_ASIN_GROUNDING_UNAVAILABLE rather
// than allowing a confident-but-unverified product through.

export interface AmazonGroundingEvidence {
  /** groundingChunks[*].web.uri */
  chunkUris: string[];
  /** groundingChunks[*].web.title */
  chunkTitles: string[];
  /** urlContextMetadata[*].retrievedUrl */
  retrievedUrls: string[];
}

export type AmazonAsinGuardReason =
  | "AMAZON_ASIN_GROUNDING_UNAVAILABLE"
  | "AMAZON_ASIN_GROUNDING_MISMATCH";

export type AmazonAsinGuardResult =
  | { ok: true }
  | { ok: false; reason: AmazonAsinGuardReason };

/**
 * Normalize a candidate URL for case-insensitive token matching.
 * - parses with URL when possible
 * - lowercases host + pathname
 * - decodeURIComponent on the pathname (guarded)
 * - drops query + fragment
 * - falls back to the lowercased raw string on parse failure
 */
function normalizeUrlForMatch(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    let path = u.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep raw pathname */
    }
    return `${u.host.toLowerCase()}${path.toLowerCase()}`;
  } catch {
    return raw.toLowerCase();
  }
}

function urlContainsAsin(normalized: string, asinLower: string): boolean {
  if (!normalized || !asinLower) return false;
  return (
    normalized.includes(`/dp/${asinLower}`) ||
    normalized.includes(`/gp/product/${asinLower}`) ||
    normalized.includes(`/gp/aw/d/${asinLower}`) ||
    normalized.includes(`/${asinLower}/`) ||
    normalized.endsWith(`/${asinLower}`)
  );
}

function titleContainsAsin(title: string, asinLower: string): boolean {
  if (!title) return false;
  return title.toLowerCase().includes(asinLower);
}

export interface VerifyArgs {
  amazonAsin: string | null;
  groundingEvidence: AmazonGroundingEvidence | null | undefined;
}

/**
 * Verify external Gemini grounding references the target Amazon ASIN.
 *
 * Behavior:
 *   - amazonAsin === null              → { ok: true }   (non-Amazon — no-op)
 *   - amazonAsin && empty evidence     → UNAVAILABLE    (fail closed)
 *   - amazonAsin found in any URL/title (after normalization) → { ok: true }
 *   - otherwise                        → MISMATCH
 *
 * Pure. Never throws.
 */
export function verifyAmazonAsinGrounding(args: VerifyArgs): AmazonAsinGuardResult {
  const asin = args.amazonAsin;
  if (!asin) return { ok: true };

  const ev = args.groundingEvidence;
  const chunkUris = ev?.chunkUris ?? [];
  const chunkTitles = ev?.chunkTitles ?? [];
  const retrievedUrls = ev?.retrievedUrls ?? [];

  const total = chunkUris.length + chunkTitles.length + retrievedUrls.length;
  if (total === 0) {
    return { ok: false, reason: "AMAZON_ASIN_GROUNDING_UNAVAILABLE" };
  }

  const asinLower = asin.toLowerCase();

  for (const u of chunkUris) {
    if (urlContainsAsin(normalizeUrlForMatch(u), asinLower)) return { ok: true };
  }
  for (const u of retrievedUrls) {
    if (urlContainsAsin(normalizeUrlForMatch(u), asinLower)) return { ok: true };
  }
  for (const t of chunkTitles) {
    if (titleContainsAsin(t, asinLower)) return { ok: true };
  }

  return { ok: false, reason: "AMAZON_ASIN_GROUNDING_MISMATCH" };
}

/**
 * Check whether normalized grounding URLs contain the canonical /dp/<ASIN>
 * (or /gp/product/<ASIN>, /gp/aw/d/<ASIN>) form. Used as a separate
 * diagnostic boolean alongside the broader token match.
 */
export function groundingContainsCanonicalDpUrl(
  amazonAsin: string,
  ev: AmazonGroundingEvidence | null | undefined,
): boolean {
  if (!amazonAsin || !ev) return false;
  const a = amazonAsin.toLowerCase();
  const all = [...(ev.chunkUris ?? []), ...(ev.retrievedUrls ?? [])];
  for (const raw of all) {
    const n = normalizeUrlForMatch(raw);
    if (
      n.includes(`/dp/${a}`) ||
      n.includes(`/gp/product/${a}`) ||
      n.includes(`/gp/aw/d/${a}`)
    ) {
      return true;
    }
  }
  return false;
}
