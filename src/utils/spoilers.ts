/**
 * Spoiler protection — shared, content-agnostic rules.
 *
 * Today only main reviews author the flag (`reviews.metadata.contains_spoilers`).
 * The helpers take any metadata object so Timeline Updates can adopt the same
 * flag later without a second implementation.
 */

/** Narrative types where a spoiler toggle is meaningful. */
export const SPOILER_ELIGIBLE_TYPES = ['movie', 'tv_show', 'book', 'game'] as const;

export function supportsSpoilerToggle(type: string | null | undefined): boolean {
  return !!type && (SPOILER_ELIGIBLE_TYPES as readonly string[]).includes(type);
}

/** Strict read: only a literal `true` counts. Anything else (legacy, malformed) = no spoilers. */
export function hasSpoilerFlag(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).contains_spoilers === true
  );
}

/**
 * Returns metadata with the flag applied: `true` is stored when enabled, the
 * key is removed when disabled. Every other key is preserved untouched.
 */
export function applySpoilerFlag(
  metadata: Record<string, unknown> | null | undefined,
  enabled: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  if (enabled) next.contains_spoilers = true;
  else delete next.contains_spoilers;
  return next;
}
