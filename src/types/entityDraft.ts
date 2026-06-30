// Phase 3.2 — Frontend mirror of the shared EntityDraft contract.
//
// Source of truth: `supabase/functions/_shared/contracts/entityDraft.types.ts`.
// This is a hand-kept duplicate so frontend code does not import across
// the Vite/Deno boundary (tsconfig excludes `supabase/functions/`).
//
// If you add or change a field in the shared contract, mirror it here.

export const ENTITY_DRAFT_SCHEMA_VERSION = 1 as const;

export type CandidateSource =
  | 'official_site'
  | 'google_images'
  | 'google_cse'
  | 'places_photo'
  | 'book_cover'
  | 'movie_poster'
  | 'open_food_facts'
  | 'firecrawl'
  | 'page_metadata'
  | 'ai_inference'
  | 'existing_entity'
  | 'user_upload'
  // Plan v10 — manual "Create new brand…" entry from BrandPicker.
  | 'admin_manual';

export type BrandStatus =
  | 'matched_existing'
  | 'suggested_new'
  | 'unknown'
  | 'not_applicable';

export type EntityDraftInputMethod =
  | 'url'
  | 'search'
  | 'image'
  | 'barcode'
  | 'manual';

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

export type EntityDraftStatus =
  | 'ok'
  | 'build_failed'
  | 'validation_failed'
  | 'schema_unavailable';
