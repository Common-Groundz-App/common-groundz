// Phase 1.6 + Phase 1.7: Amazon ASIN identity-verification guard.
//
// Phase 1.6 verifies that Gemini's EXTERNAL grounding metadata references
// the target ASIN (Path A). Phase 1.7 adds a second independent identity
// path (Path B) based on the actual fetched-page title/JSON-LD product
// name, plus a bot-wall/generic anchor filter and a canonical-ASIN
// consistency check. Either path alone is sufficient.
//
// Evidence policy — Path A external-only:
//   - groundingChunks[*].web.uri
//   - groundingChunks[*].web.title
//   - urlContextMetadata[*].retrievedUrl
// Excluded (must never be passed in):
//   - prompt text
//   - our canonical URL hint
//   - webSearchQueries
//   - groundingSupports[*].segment.text
//   - the model's answer text
//
// Path B uses already-fetched Amazon HTML page signals — title/OG/Twitter/
// JSON-LD Product.name — and a distinctive-token overlap check against the
// model's returned `name`. Stop-list is guard-internal; never mutates name.

import { isStrictAmazonHost } from "./host_hints.ts";
import {
  hashToken,
  bucketRatio,
  type AnchorSource,
  type AmazonGuardExtendedDiagnostics,
} from "./finalization_telemetry.ts";

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
  | "AMAZON_ASIN_GROUNDING_MISMATCH"
  | "AMAZON_NAME_PAGE_TITLE_MISMATCH";

export type AmazonAsinGuardResult =
  | { ok: true }
  | { ok: false; reason: AmazonAsinGuardReason };

function normalizeUrlForMatch(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    let path = u.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep */ }
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

/** Phase 1.6 — Path A only. Kept stable for existing callers/tests. */
export function verifyAmazonAsinGrounding(args: VerifyArgs): AmazonAsinGuardResult {
  const asin = args.amazonAsin;
  if (!asin) return { ok: true };
  const ev = args.groundingEvidence;
  const chunkUris = ev?.chunkUris ?? [];
  const chunkTitles = ev?.chunkTitles ?? [];
  const retrievedUrls = ev?.retrievedUrls ?? [];
  const total = chunkUris.length + chunkTitles.length + retrievedUrls.length;
  if (total === 0) return { ok: false, reason: "AMAZON_ASIN_GROUNDING_UNAVAILABLE" };
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
    ) return true;
  }
  return false;
}

// ─── Phase 1.7: Page-signal identity anchor + dual-path verification ─────

export interface PageSignalsForGuard {
  title: string | null;
  og_title: string | null;
  og_description?: string | null;
  og_site_name?: string | null;
  og_image?: string | null;
  twitter_title: string | null;
  twitter_description?: string | null;
  canonical: string | null;
  jsonld_product_name: string | null;
  jsonld_brand?: string | null;
}

// Generic / bot-wall substrings (lowercased, substring match).
const BOT_WALL_SUBSTRINGS = [
  "robot check",
  "captcha",
  "amazon sign-in",
  "amazon sign in",
  "sign in",
  "sorry, something went wrong",
  "something went wrong",
  "page not found",
  "404",
  "access denied",
  "enter the characters",
];

// Bare site names. After stripping punctuation/whitespace, equality match.
const BARE_SITE_NAMES = new Set([
  "amazon",
  "amazonin",
  "amazoncom",
  "amazoncouk",
  "amazonde",
  "amazonca",
  "amazonfr",
  "amazoncojp",
  "amazoncomau",
  "amazonit",
  "amazones",
]);

function isBotWallOrGeneric(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (s.length < 4) return true;
  for (const sub of BOT_WALL_SUBSTRINGS) {
    if (s.includes(sub)) return true;
  }
  const compact = s.replace(/[^a-z0-9]/g, "");
  if (BARE_SITE_NAMES.has(compact)) return true;
  return false;
}

// Stop-tokens (guard-internal). Never mutates returned name.
const STOP_TOKENS = new Set([
  // category / marketing / pack-size
  "root","roots","hair","serum","cleanser","dandruff","scalp","oil","treatment",
  "shampoo","conditioner","mask","cream","lotion","gel","spray","balm",
  "men","women","kids","baby","natural","organic","herbal","ayurvedic","vegan",
  "anti","pollution","protect","vital","fall","growth","care","new","pack","set",
  "combo","kit","bottle","refill","ml","gm","mg","kg","count","oz","pcs","piece","value",
  // platform / generic
  "amazon","official","store","india","com","www","https","http","the","and","with","for",
]);

function distinctiveTokens(s: string): Set<string> {
  const out = new Set<string>();
  const norm = s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!norm) return out;
  for (const tok of norm.split(/\s+/)) {
    if (tok.length < 3) continue;
    if (/^\d+$/.test(tok)) continue;
    if (STOP_TOKENS.has(tok)) continue;
    out.add(tok);
  }
  return out;
}

const ASIN_IN_URL_RE = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i;

function extractAsinFromCanonical(canonical: string): string | null {
  const m = canonical.match(ASIN_IN_URL_RE);
  return m ? m[1].toUpperCase() : null;
}

export type PageTitleAnchorRejectReason =
  | "BOT_WALL_OR_GENERIC"
  | "AMAZON_CANONICAL_ASIN_MISMATCH";

export interface PageTitleAnchorResult {
  anchor: string | null;
  reject_reason: PageTitleAnchorRejectReason | null;
  canonical_asin_mismatch: boolean;
  /** Phase 1.8c.2 — which signal produced the anchor. */
  source: AnchorSource;
}

/**
 * Walk jsonld_product_name → og_title → twitter_title → title and return the
 * first valid candidate. Validates against bot-wall/generic + canonical-ASIN
 * consistency. Returns reject reason when all candidates are invalid or when
 * canonical ASIN differs from requested ASIN.
 */
export function pickPageTitleAnchor(
  pageSignals: PageSignalsForGuard | null | undefined,
  requestedAsin: string | null,
): PageTitleAnchorResult {
  if (!pageSignals) {
    return { anchor: null, reject_reason: null, canonical_asin_mismatch: false, source: "none" };
  }

  // Canonical-ASIN consistency check first — if mismatch, page is not
  // authoritative for the requested ASIN regardless of title contents.
  let canonical_asin_mismatch = false;
  if (requestedAsin && pageSignals.canonical) {
    const canonAsin = extractAsinFromCanonical(pageSignals.canonical);
    if (canonAsin && canonAsin.toUpperCase() !== requestedAsin.toUpperCase()) {
      canonical_asin_mismatch = true;
      return {
        anchor: null,
        reject_reason: "AMAZON_CANONICAL_ASIN_MISMATCH",
        canonical_asin_mismatch: true,
        source: "none",
      };
    }
  }

  const candidates: Array<{ value: string | null; source: AnchorSource }> = [
    { value: pageSignals.jsonld_product_name, source: "jsonld_product_name" },
    { value: pageSignals.og_title,            source: "og_title" },
    { value: pageSignals.twitter_title,       source: "twitter_title" },
    { value: pageSignals.title,               source: "html_title" },
  ];
  for (const c of candidates) {
    if (c.value && typeof c.value === "string" && !isBotWallOrGeneric(c.value)) {
      return { anchor: c.value, reject_reason: null, canonical_asin_mismatch, source: c.source };
    }
  }
  // Anything present? Then they were all bot-wall/generic.
  if (candidates.some((c) => typeof c.value === "string" && c.value.trim().length > 0)) {
    return {
      anchor: null,
      reject_reason: "BOT_WALL_OR_GENERIC",
      canonical_asin_mismatch,
      source: "none",
    };
  }
  return { anchor: null, reject_reason: null, canonical_asin_mismatch, source: "none" };
}

export type DualPathRejectReason =
  | AmazonAsinGuardReason
  | "AMAZON_NAME_PAGE_TITLE_MISMATCH";

export type AmazonIdentityVerifiedVia =
  | "external_grounding"
  | "page_title_anchor"
  | "both"
  | null;

export interface DualPathDiagnostics {
  amazon_asin_present: boolean;
  grounding_contains_target_asin: boolean;
  grounding_contains_canonical_dp_url: boolean;
  amazon_exact_match_verified: boolean;
  amazon_exact_match_reject_reason: string | null;
  page_title_anchor_present: boolean;
  page_title_match_verified: boolean | null;
  page_title_match_skip_reason: string | null;
  page_title_anchor_reject_reason: string | null;
  amazon_canonical_asin_mismatch: boolean;
  amazon_identity_verified_via: AmazonIdentityVerifiedVia;
  /** Phase 1.8c.2 — extended Amazon diagnostics for guard-decision triage. */
  extended?: AmazonGuardExtendedDiagnostics;
}

export interface DualPathArgs {
  amazonAsin: string | null;
  groundingEvidence: AmazonGroundingEvidence | null | undefined;
  pageSignals: PageSignalsForGuard | null | undefined;
  modelName: string | null | undefined;
}

export interface DualPathResult {
  ok: boolean;
  reason: DualPathRejectReason | null;
  diagnostics: DualPathDiagnostics;
}

/**
 * Phase 1.7 dual-path identity verification.
 *
 * Accept if AT LEAST ONE of:
 *   Path A — external grounding contains the ASIN
 *   Path B — page title anchor (after bot-wall + canonical-ASIN filters)
 *            shares ≥ 1 distinctive token with the model's returned name
 *
 * Reject (AMAZON_NAME_PAGE_TITLE_MISMATCH) when a usable anchor exists with
 * distinctive tokens and the model name shares none of them — fetched page
 * always wins over search neighbors.
 *
 * NOTE: This function does NOT set prediction_source. That field is owned
 * by the caller and reflects where the prediction came from (gemini_primary,
 * gemini_recovery, gemini_search_fallback). Identity-verification path is
 * reported only via diagnostics.amazon_identity_verified_via.
 */
export function runDualPathVerification(args: DualPathArgs): DualPathResult {
  const diag: DualPathDiagnostics = {
    amazon_asin_present: !!args.amazonAsin,
    grounding_contains_target_asin: false,
    grounding_contains_canonical_dp_url: false,
    amazon_exact_match_verified: false,
    amazon_exact_match_reject_reason: null,
    page_title_anchor_present: false,
    page_title_match_verified: null,
    page_title_match_skip_reason: null,
    page_title_anchor_reject_reason: null,
    amazon_canonical_asin_mismatch: false,
    amazon_identity_verified_via: null,
  };

  if (!args.amazonAsin) {
    diag.amazon_exact_match_verified = true;
    return { ok: true, reason: null, diagnostics: diag };
  }

  // ── Path A: external grounding ──────────────────────────────────────────
  const ev: AmazonGroundingEvidence = {
    chunkUris: args.groundingEvidence?.chunkUris ?? [],
    chunkTitles: args.groundingEvidence?.chunkTitles ?? [],
    retrievedUrls: args.groundingEvidence?.retrievedUrls ?? [],
  };
  const pathAVerdict = verifyAmazonAsinGrounding({
    amazonAsin: args.amazonAsin,
    groundingEvidence: ev,
  });
  const pathAOk = pathAVerdict.ok === true;
  diag.grounding_contains_target_asin = pathAOk;
  diag.grounding_contains_canonical_dp_url = groundingContainsCanonicalDpUrl(
    args.amazonAsin,
    ev,
  );

  // ── Path B: page-title anchor ──────────────────────────────────────────
  const anchorPick = pickPageTitleAnchor(args.pageSignals, args.amazonAsin);
  diag.amazon_canonical_asin_mismatch = anchorPick.canonical_asin_mismatch;
  diag.page_title_anchor_reject_reason = anchorPick.reject_reason;
  diag.page_title_anchor_present = !!anchorPick.anchor;

  let pathBOk = false;
  let pathBHasDistinctive = false;
  let pathBOverlaps = false;
  let anchorTokensArr: string[] = [];
  let nameTokensArr: string[] = [];
  let overlapTokensArr: string[] = [];
  if (anchorPick.anchor) {
    const anchorTokens = distinctiveTokens(anchorPick.anchor);
    anchorTokensArr = Array.from(anchorTokens);
    pathBHasDistinctive = anchorTokens.size > 0;
    if (!pathBHasDistinctive) {
      diag.page_title_match_skip_reason = "NO_DISTINCTIVE_TOKENS";
    } else {
      const nameTokens = distinctiveTokens(args.modelName ?? "");
      nameTokensArr = Array.from(nameTokens);
      for (const t of nameTokens) {
        if (anchorTokens.has(t)) {
          overlapTokensArr.push(t);
          pathBOverlaps = true;
        }
      }
      pathBOk = pathBOverlaps;
    }
  } else {
    diag.page_title_match_skip_reason = "NO_PAGE_TITLE_ANCHOR";
    // Still collect model-name tokens for diagnostics so reviewers can see
    // whether the model produced anything tokenizable.
    nameTokensArr = Array.from(distinctiveTokens(args.modelName ?? ""));
  }

  // ── Phase 1.8c.2: extended diagnostics (Amazon-only triage) ────────────
  diag.extended = buildExtendedDiagnostics({
    anchorPick,
    anchorTokens: anchorTokensArr,
    nameTokens: nameTokensArr,
    overlapTokens: overlapTokensArr,
    groundingEvidence: ev,
    pageSignals: args.pageSignals ?? null,
  });

  // ── Combine ─────────────────────────────────────────────────────────────
  // Case: usable anchor with distinctive tokens AND model does NOT overlap →
  // fetched page wins over any external-grounding pass.
  if (anchorPick.anchor && pathBHasDistinctive && !pathBOverlaps) {
    diag.amazon_exact_match_verified = pathAOk;
    diag.amazon_exact_match_reject_reason = pathAOk
      ? null
      : (pathAVerdict as { reason: AmazonAsinGuardReason }).reason;
    diag.page_title_match_verified = false;
    return {
      ok: false,
      reason: "AMAZON_NAME_PAGE_TITLE_MISMATCH",
      diagnostics: diag,
    };
  }

  if (pathAOk && pathBOk) {
    diag.amazon_exact_match_verified = true;
    diag.page_title_match_verified = true;
    diag.amazon_identity_verified_via = "both";
    return { ok: true, reason: null, diagnostics: diag };
  }
  if (pathAOk) {
    diag.amazon_exact_match_verified = true;
    diag.amazon_identity_verified_via = "external_grounding";
    return { ok: true, reason: null, diagnostics: diag };
  }
  if (pathBOk) {
    diag.amazon_exact_match_verified = false;
    diag.page_title_match_verified = true;
    diag.amazon_identity_verified_via = "page_title_anchor";
    return { ok: true, reason: null, diagnostics: diag };
  }
  // Both failed → preserve Phase 1.6 reject reason from Path A.
  const reason = (pathAVerdict as { ok: false; reason: AmazonAsinGuardReason }).reason;
  diag.amazon_exact_match_reject_reason = reason;
  return { ok: false, reason, diagnostics: diag };
}
