// Phase 2.1 — Deno mirror of the frontend review-category bucket mapping.
//
// Source of truth for AUTHORING is the frontend:
//   src/components/profile/reviews/subjectSelection.ts::mapCanonicalToLegacyCategory
// Edge functions cannot import from `src/` (only paths under supabase/functions
// deploy), so this file mirrors it. The mirror is NOT free-floating: a Vitest
// contract test asserts, for every canonical type, that this file and the
// frontend mapping agree, and that the reverse expansion is exactly the
// inverse. Adding a canonical type without updating this file fails CI.
//
// Why this exists at all: `reviews.category` used to hold only the five legacy
// buckets. From Phase 2.1 it holds the real canonical entity type, so consumers
// that still reason in five buckets must normalize first.

import { CANONICAL_ENTITY_TYPES, type CanonicalEntityType } from "./entityTypes.ts";

export const REVIEW_BUCKETS = ["food", "movie", "book", "place", "product"] as const;
export type ReviewBucket = typeof REVIEW_BUCKETS[number];

/** Canonical entity type → legacy five-bucket questionnaire/compat category. */
export const CANONICAL_TO_BUCKET: Readonly<Record<CanonicalEntityType, ReviewBucket>> = {
  food: "food",
  movie: "movie",
  tv_show: "movie",
  book: "book",
  place: "place",
  experience: "place",
  event: "place",
  product: "product",
  brand: "product",
  service: "product",
  professional: "product",
  course: "product",
  app: "product",
  game: "product",
  others: "product",
};

export function isReviewBucket(value: unknown): value is ReviewBucket {
  return typeof value === "string" && (REVIEW_BUCKETS as readonly string[]).includes(value);
}

/**
 * Normalize any stored category into one of the five buckets.
 *
 * Idempotent: `normalize(normalize(x)) === normalize(x)`.
 * Explicit unknown handling: a value that is neither a canonical type nor a
 * bucket returns `null` — callers DROP it rather than folding it into
 * `product`, which would invent a preference the user never expressed.
 */
export function normalizeToReviewBucket(value: unknown): ReviewBucket | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (isReviewBucket(v)) return v;
  if ((CANONICAL_ENTITY_TYPES as readonly string[]).includes(v)) {
    return CANONICAL_TO_BUCKET[v as CanonicalEntityType];
  }
  return null;
}

/**
 * Reverse mapping: a detected bucket → every canonical type that buckets into
 * it, plus the bucket value itself (legacy rows still store the bucket).
 *
 * Used by smart-assistant so a bucket-keyword match keeps finding both legacy
 * rows (`product`) and newly canonicalized rows (`course`, `game`, ...).
 */
export function expandBucketToCanonical(bucket: string): string[] {
  const normalized = typeof bucket === "string" ? bucket.trim().toLowerCase() : "";
  if (!isReviewBucket(normalized)) return normalized ? [normalized] : [];
  const members = CANONICAL_ENTITY_TYPES.filter(
    (t) => CANONICAL_TO_BUCKET[t] === normalized,
  ) as string[];
  return members.includes(normalized) ? members : [normalized, ...members];
}

/** Expand a list of detected buckets, de-duplicated. */
export function expandBucketsToCanonical(buckets: readonly string[]): string[] {
  const out = new Set<string>();
  for (const b of buckets) {
    for (const v of expandBucketToCanonical(b)) out.add(v);
  }
  return [...out];
}
