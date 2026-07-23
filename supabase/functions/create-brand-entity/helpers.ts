// Phase 2 — Pure helpers for create-brand-entity, extracted for offline testing.
// No Supabase, no network, no auth. Tested in ./index.test.ts.

/**
 * Returns true only when we should race-safely backfill a brand's missing logo.
 *  - shouldWrite must be true (client passed confirmCreate)
 *  - logoUrl must be a non-empty string
 *  - existingImageUrl must be null/empty (we never overwrite)
 */
export function shouldBackfillLogo(
  existingImageUrl: string | null | undefined,
  logoUrl: unknown,
  shouldWrite: boolean,
): boolean {
  if (!shouldWrite) return false;
  if (typeof logoUrl !== "string" || logoUrl.length === 0) return false;
  if (existingImageUrl != null && existingImageUrl !== "") return false;
  return true;
}

/**
 * Pure slug normalizer for brand names. Lowercase, hyphenated, trimmed.
 * Does NOT handle DB collisions — that stays in the handler's insert loop.
 */
export function normalizeBrandSlug(brandName: string): string {
  if (typeof brandName !== "string") return "";
  return brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
