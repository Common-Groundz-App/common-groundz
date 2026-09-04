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
  /**
   * Keys to DELETE from the merged result. Needed because "absent" is a real,
   * meaningful state for `questionnaire` and `food_tags` — a merge alone can
   * never express removal.
   */
  removeKeys: readonly string[] = [],
): ReviewMetadata | undefined {
  const base = isPlainMetadataObject(existing) ? { ...existing } : {};
  const merged = patch ? { ...base, ...patch } : base;
  for (const key of removeKeys) delete merged[key];
  return Object.keys(merged).length > 0 ? merged : undefined;
}
