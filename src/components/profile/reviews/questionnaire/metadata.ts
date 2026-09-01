/**
 * Phase 3A — safe `reviews.metadata` merging.
 *
 * `updateReview` writes the whole JSONB column, so building metadata from
 * scratch on save silently destroys provenance and any unrelated keys. Every
 * write must merge onto the existing object.
 *
 * Non-objects (arrays, strings, numbers, null) are NEVER spread — a malformed
 * stored value is treated as "no metadata" rather than being splatted into the
 * new object.
 */
export type ReviewMetadata = Record<string, unknown>;

export function isPlainMetadataObject(value: unknown): value is ReviewMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergeReviewMetadata(
  existing: unknown,
  patch: ReviewMetadata | undefined,
): ReviewMetadata | undefined {
  const base = isPlainMetadataObject(existing) ? { ...existing } : {};
  if (!patch || Object.keys(patch).length === 0) {
    return Object.keys(base).length > 0 ? base : undefined;
  }
  return { ...base, ...patch };
}
