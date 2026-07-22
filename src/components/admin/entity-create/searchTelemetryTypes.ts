// Phase 3.5c v2 — Search-to-Draft finalization telemetry types.
// Shared between DraftReviewBody, CreateEntityDialog, useSearchFunnel, and
// the log-search-funnel edge function (mirrored there — no cross-boundary import).

export const INITIAL_IMAGE_SOURCES = [
  'page_metadata',
  'firecrawl',
  'google_images',
  'none',
  'unknown',
] as const;
export type InitialImageSource = typeof INITIAL_IMAGE_SOURCES[number];

export const FINAL_IMAGE_SOURCES = [
  'page_metadata',
  'firecrawl',
  'google_images',
  'user_replaced',
  'none',
  'unknown',
] as const;
export type FinalImageSource = typeof FINAL_IMAGE_SOURCES[number];

export const BRAND_DECISION_TYPES = [
  'existing',
  'create_new',
  'not_sure',
  'not_listed',
  'not_applicable',
] as const;
export type BrandDecisionType = typeof BRAND_DECISION_TYPES[number];

export const IMAGE_METHODS = ['google_cse', 'unknown'] as const;
export type ImageMethod = typeof IMAGE_METHODS[number];

/** Immutable snapshot of the Search draft at the moment it is applied to the host form. */
export interface SearchDraftSnapshot {
  nameGuess: string;
  descriptionGuess: string;
  websiteGuess: string;
  categoryIdGuess: string | null;
  metadataGuess: Record<string, unknown>;
  /** Brand entity id chosen in Stage 1 (or null if none / unknown / not applicable). */
  brandId: string | null;
  brandDecisionType: BrandDecisionType;
  /** Primary image URL as it was set when applied (may be a user_upload blob). */
  imageUrlAtPrefill: string | null;
  initialImageSource: InitialImageSource;
  initialImageMethod?: ImageMethod;
  /** Map: candidate URL → InitialImageSource (also lets us classify the final image). */
  imageCandidatesByUrl: Record<string, InitialImageSource>;
  /** Map: candidate URL → CandidateSource for finer method detection. */
  imageCandidatesByRawSource: Record<string, string>;
}

/** Payload of the final diff sent to log-search-funnel. Booleans + enums only. */
export interface SearchFinalizationDiff {
  nameChanged: boolean;
  categoryChanged: boolean;
  brandChanged: boolean;
  imageChanged: boolean;
  descriptionChanged: boolean;
  websiteChanged: boolean;
  metadataChanged: boolean;
  imageUserReplaced: boolean;
  initialImageSource: InitialImageSource;
  finalImageSource: FinalImageSource;
  brandDecisionType: BrandDecisionType;
  imageMethod?: ImageMethod;
}

/** Map raw draft CandidateSource → coarse InitialImageSource enum. */
export function mapCandidateSourceToInitial(source: string | undefined | null): InitialImageSource {
  if (!source) return 'unknown';
  switch (source) {
    case 'page_metadata':
      return 'page_metadata';
    case 'firecrawl':
      return 'firecrawl';
    case 'google_images':
    case 'google_cse':
    case 'google_grounding':
      return 'google_images';
    default:
      return 'unknown';
  }
}

/** Method is only meaningful for google_images. */
export function mapCandidateSourceToMethod(source: string | undefined | null): ImageMethod | undefined {
  if (source === 'google_cse') return 'google_cse';
  if (source === 'google_images' || source === 'google_grounding') return 'unknown';
  return undefined;
}

/** Keys in structuredHints that admins actually see — used for metadataChanged. */
const USER_RELEVANT_METADATA_KEYS = new Set([
  'brand', 'category', 'ingredients', 'variant', 'volume', 'weight',
  'authors', 'publication_year', 'isbn', 'languages', 'cast_crew',
  'specifications', 'nutritional_info', 'external_ratings', 'price_info',
]);

export function pickUserRelevantMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    if (USER_RELEVANT_METADATA_KEYS.has(k)) out[k] = src[k];
  }
  return out;
}

export function normalizeText(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.trim().toLocaleLowerCase();
}
