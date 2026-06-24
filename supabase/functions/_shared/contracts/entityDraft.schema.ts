// Phase 3.1 — Shared EntityDraft contract (Zod schema mirror).
//
// IMPORTANT: this file uses a Deno specifier for Zod and is intended for
// edge functions only. Frontend code must import from `./entityDraft.types.ts`
// (pure types). The schema MUST import and validate successfully in the
// Deno edge runtime — silent skip is not an acceptable fallback.
//
// If Zod cannot be loaded here, fix the import pattern before merging.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  ENTITY_DRAFT_SCHEMA_VERSION,
  type EntityDraft,
} from "./entityDraft.types.ts";

const CandidateSourceSchema = z.enum([
  "official_site",
  "google_images",
  "google_cse",
  "places_photo",
  "book_cover",
  "movie_poster",
  "open_food_facts",
  "firecrawl",
  "page_metadata",
  "ai_inference",
  "existing_entity",
  "user_upload",
]);

const BrandStatusSchema = z.enum([
  "matched_existing",
  "suggested_new",
  "unknown",
  "not_applicable",
]);

const InputMethodSchema = z.enum(["url", "search", "image", "barcode", "manual"]);

const BrandCandidateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  logoUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
  source: CandidateSourceSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
  status: BrandStatusSchema,
});

const ImageCandidateSchema = z.object({
  url: z.string().min(1),
  source: CandidateSourceSchema,
  confidence: z.number().min(0).max(1),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  isLogo: z.boolean().optional(),
  isProductShot: z.boolean().optional(),
  reason: z.string().optional(),
});

const SourceEvidenceSchema = z.object({
  field: z.string().min(1),
  value: z.string().max(200),
  source: CandidateSourceSchema,
  confidence: z.number().min(0).max(1),
});

export const EntityDraftSchema = z.object({
  schemaVersion: z.literal(ENTITY_DRAFT_SCHEMA_VERSION),
  inputMethod: InputMethodSchema,
  inputRef: z.string().min(1),
  nameGuess: z.string().optional(),
  typeGuess: z.string().optional(),
  descriptionGuess: z.string().optional(),
  categoryHint: z
    .object({ id: z.string().optional(), path: z.string().optional() })
    .optional(),
  structuredHints: z.record(z.unknown()).optional(),
  brandCandidates: z.array(BrandCandidateSchema),
  imageCandidates: z.array(ImageCandidateSchema),
  recommendedBrandIndex: z.number().int().nonnegative().optional(),
  recommendedImageIndex: z.number().int().nonnegative().optional(),
  sourceEvidence: z.array(SourceEvidenceSchema),
  warnings: z.array(z.string()).optional(),
});

/** Throws on invalid input. Caller wraps in try/catch and surfaces a
 *  `validation_failed` diagnostic + null draft. */
export function validateEntityDraft(draft: unknown): EntityDraft {
  return EntityDraftSchema.parse(draft) as EntityDraft;
}
