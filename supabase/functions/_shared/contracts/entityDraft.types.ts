// Phase 3.1 — Shared EntityDraft contract (pure types/constants).
//
// This file has ZERO runtime imports so it is safe to import from both:
//   - Vite/browser code (frontend, Phase 3.2+ UI)
//   - Deno edge functions (analyze-entity-url-v2, future adapters)
//
// The Zod schema mirror lives in `./entityDraft.schema.ts`. Keep the
// two files in sync — any field added here must be added there too.

export const ENTITY_DRAFT_SCHEMA_VERSION = 1 as const;

export type CandidateSource =
  | "official_site"
  | "google_images"
  | "google_cse"
  | "google_grounding"
  | "places_photo"
  | "book_cover"
  | "movie_poster"
  | "open_food_facts"
  | "firecrawl"
  | "page_metadata"
  | "ai_inference"
  | "existing_entity"
  | "user_upload";

export type BrandStatus =
  | "matched_existing"
  | "suggested_new"
  | "unknown"
  | "not_applicable";

export type EntityDraftInputMethod =
  | "url"
  | "search"
  | "image"
  | "barcode"
  | "manual";

export interface BrandCandidate {
  id?: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  source: CandidateSource;
  confidence: number;
  reason?: string;
  status: BrandStatus;
}

export interface ImageCandidate {
  /** ORIGINAL, unmodified URL — used for display + fetch. Never mutated
   *  by dedupe/normalization. A normalized key is computed separately
   *  only for dedupe comparisons. */
  url: string;
  source: CandidateSource;
  confidence: number;
  width?: number;
  height?: number;
  isLogo?: boolean;
  isProductShot?: boolean;
  reason?: string;
}

export interface SourceEvidence {
  field: string;
  /** Short + sanitized: hard-capped at 200 chars, no HTML, no query
   *  strings for URL values, no auth/session tokens. */
  value: string;
  source: CandidateSource;
  confidence: number;
}

export interface EntityDraft {
  schemaVersion: typeof ENTITY_DRAFT_SCHEMA_VERSION;
  inputMethod: EntityDraftInputMethod;
  inputRef: string;
  nameGuess?: string;
  typeGuess?: string;
  descriptionGuess?: string;
  categoryHint?: { id?: string; path?: string };
  structuredHints?: Record<string, unknown>;
  brandCandidates: BrandCandidate[];
  imageCandidates: ImageCandidate[];
  recommendedBrandIndex?: number;
  recommendedImageIndex?: number;
  sourceEvidence: SourceEvidence[];
  warnings?: string[];
}

/** Tri-state diagnostic surfaced on response.metadata.entityDraftStatus.
 *  - 'ok'                  : draft built and validated successfully
 *  - 'build_failed'        : assembly threw before validation
 *  - 'validation_failed'   : assembled, Zod rejected it
 *  - 'schema_unavailable'  : Zod import did not load at runtime
 *                            (should never happen in normal operation —
 *                             treat as a hard bug if it appears) */
export type EntityDraftStatus =
  | "ok"
  | "build_failed"
  | "validation_failed"
  | "schema_unavailable";
