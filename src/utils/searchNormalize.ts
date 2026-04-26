/**
 * Single source of truth for search query normalization.
 *
 * Used by both the search hook (to compute `settledQuery`) and the Search page
 * (to gate the loader and commit results). Keeping this in ONE place prevents
 * subtle mismatches — e.g. `trim().toLowerCase()` vs `toLowerCase().trim()`,
 * or `toLowerCase()` vs `toLocaleLowerCase()` (Turkish "İ"/"i" edge case) —
 * that could cause the loader to stick or flash.
 */
export const normalizeSearchQuery = (s: string): string =>
  s.trim().toLocaleLowerCase();
