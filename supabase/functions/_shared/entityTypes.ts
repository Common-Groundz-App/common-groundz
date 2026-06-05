// Edge-function mirror of `src/services/entityTypeHelpers.ts::getActiveEntityTypes()`.
// Stable canonical taxonomy used across edge functions.
//
// NOT the universal source of truth — must stay in sync with the frontend
// helper until a repo-level shared module exists.
//
// Phase-specific extraction subsets (e.g. Phase-5 exact-page extractable set)
// live with their phase code, NOT here.
//
// Legacy `generic` key from `src/config/entityTypeConfig.ts` is intentionally
// excluded — it is not part of the active taxonomy.

export const CANONICAL_ENTITY_TYPES = [
  "movie",
  "book",
  "tv_show",
  "course",
  "app",
  "game",
  "experience",
  "food",
  "product",
  "place",
  "brand",
  "event",
  "service",
  "professional",
  "others",
] as const;

export type CanonicalEntityType = typeof CANONICAL_ENTITY_TYPES[number];

export function isCanonicalEntityType(value: unknown): value is CanonicalEntityType {
  return typeof value === "string" &&
    (CANONICAL_ENTITY_TYPES as readonly string[]).includes(value);
}
