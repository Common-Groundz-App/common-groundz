/**
 * Canonical entity types — single source of truth.
 *
 * Plain TypeScript. NO React imports, NO UI concerns. Services, hooks and
 * edge-shared code must all be able to import this module.
 *
 * Rules:
 * - There are exactly 15 canonical types, matching the Supabase `entity_type` enum.
 * - `parseEntityType` returns `null` for anything invalid. There is no
 *   `'unsupported'` pseudo-value and no silent fallback to `product` / `place`,
 *   so a 16th type can never be persisted through this module.
 * - Legacy aliases are accepted ONLY at explicit external boundaries via
 *   `parseEntityTypeAtBoundary`. They are never written back out.
 */

export const CANONICAL_ENTITY_TYPES = [
  'movie',
  'book',
  'tv_show',
  'course',
  'app',
  'game',
  'experience',
  'food',
  'product',
  'place',
  'brand',
  'event',
  'service',
  'professional',
  'others',
] as const;

export type CanonicalEntityType = (typeof CANONICAL_ENTITY_TYPES)[number];

const CANONICAL_SET: ReadonlySet<string> = new Set(CANONICAL_ENTITY_TYPES);

/**
 * Legacy aliases that may still arrive from external/older payloads.
 * Accepted on the way IN only (see `parseEntityTypeAtBoundary`), never written.
 */
export const LEGACY_ENTITY_TYPE_ALIASES: Readonly<Record<string, CanonicalEntityType>> = {
  tv: 'tv_show',
  activity: 'experience',
  music: 'others',
  art: 'others',
  drink: 'food',
  travel: 'place',
  people: 'professional',
};

/** Type guard for a canonical entity type. */
export function isCanonicalEntityType(value: unknown): value is CanonicalEntityType {
  return typeof value === 'string' && CANONICAL_SET.has(value);
}

/**
 * Strict parser. Returns the canonical type, or `null` when the value is not one
 * of the 15 canonical types. Case-insensitive and whitespace-tolerant only —
 * it does NOT resolve legacy aliases.
 */
export function parseEntityType(value: unknown): CanonicalEntityType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return CANONICAL_SET.has(normalized) ? (normalized as CanonicalEntityType) : null;
}

/**
 * Boundary parser: use ONLY where untrusted/legacy external input enters the app
 * (old URLs, third-party payloads, historical analytics rows). Resolves legacy
 * aliases in addition to canonical values. Still returns `null` when unknown.
 */
export function parseEntityTypeAtBoundary(value: unknown): CanonicalEntityType | null {
  const direct = parseEntityType(value);
  if (direct) return direct;
  if (typeof value !== 'string') return null;
  const alias = LEGACY_ENTITY_TYPE_ALIASES[value.trim().toLowerCase()];
  return alias ?? null;
}
