/**
 * Structured Experience Fields — Phase 3
 * Types, constants, and cleaning utilities for structured post data.
 */

export interface PostLocation {
  name: string;
  address?: string | null;
  place_id?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

export interface StructuredFields {
  what_worked?: string;
  what_didnt?: string;
  duration?: string;
  good_for?: string;
  reuse_intent?: 'yes' | 'no';
  /**
   * UI-only post type marker for types that don't have a dedicated DB enum
   * value (journal, watching → both stored as DB post_type 'note'). Lets the
   * composer re-hydrate the correct chip on edit.
   */
  ui_post_type?: 'journal' | 'watching';
  /**
   * Structured location data captured from the composer's location chip.
   * Stored here (not in a dedicated `metadata` column) to avoid a schema
   * migration. Always validated via `isValidStoredLocation` on read/write.
   */
  location?: PostLocation;
  _v: number;
}

/**
 * Validates a stored location object. A valid location must have a non-empty
 * trimmed `name`. Coordinates are optional, but if present must be a
 * `{ lat, lng }` pair of finite numbers — partial/string-shaped coords are
 * rejected entirely (caller should drop the coordinates key, not half-store).
 */
export function isValidStoredLocation(loc: any): loc is PostLocation {
  if (!loc || typeof loc !== 'object') return false;
  if (typeof loc.name !== 'string' || loc.name.trim().length === 0) return false;
  if (loc.coordinates !== undefined && loc.coordinates !== null) {
    const c = loc.coordinates;
    if (
      typeof c !== 'object' ||
      typeof c.lat !== 'number' ||
      typeof c.lng !== 'number' ||
      !Number.isFinite(c.lat) ||
      !Number.isFinite(c.lng)
    ) {
      return false;
    }
  }
  return true;
}

export const DURATION_OPTIONS: Record<string, string> = {
  lt_1w: 'Less than a week',
  '1_4w': '1–4 weeks',
  '1_3m': '1–3 months',
  '3_6m': '3–6 months',
  '6_12m': '6–12 months',
  '1y_plus': 'Over a year',
};

export const ALLOWED_STRUCTURED_KEYS = [
  'what_worked',
  'what_didnt',
  'duration',
  'good_for',
  'reuse_intent',
  'ui_post_type',
  'location',
] as const;

const VALID_UI_POST_TYPES = ['journal', 'watching'];

const LEGACY_KEY_MAP: Record<string, string> = {
  pros: 'what_worked',
  cons: 'what_didnt',
  best_for: 'good_for',
};

const VALID_DURATIONS = Object.keys(DURATION_OPTIONS);
const VALID_REUSE = ['yes', 'no'];

function trimAndCollapse(str: string): string {
  return str.trim().replace(/\s{2,}/g, ' ');
}

function enforceMaxLength(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) : str;
}

/**
 * Cleans and validates structured fields input.
 * Returns null if no meaningful data exists.
 */
export function cleanStructuredFields(
  input: Record<string, any> | null | undefined
): StructuredFields | null {
  if (!input || typeof input !== 'object') return null;

  // Map legacy keys
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    const mappedKey = LEGACY_KEY_MAP[key] || key;
    if ((ALLOWED_STRUCTURED_KEYS as readonly string[]).includes(mappedKey)) {
      mapped[mappedKey] = value;
    }
  }

  const result: Partial<StructuredFields> = {};

  // Narrative fields (max 500)
  if (typeof mapped.what_worked === 'string') {
    const cleaned = enforceMaxLength(trimAndCollapse(mapped.what_worked), 500);
    if (cleaned) result.what_worked = cleaned;
  }
  if (typeof mapped.what_didnt === 'string') {
    const cleaned = enforceMaxLength(trimAndCollapse(mapped.what_didnt), 500);
    if (cleaned) result.what_didnt = cleaned;
  }

  // Good for (max 300, preserve casing)
  if (typeof mapped.good_for === 'string') {
    const cleaned = enforceMaxLength(trimAndCollapse(mapped.good_for), 300);
    if (cleaned) result.good_for = cleaned;
  }

  // Duration enum
  if (typeof mapped.duration === 'string' && VALID_DURATIONS.includes(mapped.duration)) {
    result.duration = mapped.duration;
  }

  // Reuse intent
  if (typeof mapped.reuse_intent === 'string' && VALID_REUSE.includes(mapped.reuse_intent)) {
    result.reuse_intent = mapped.reuse_intent as 'yes' | 'no';
  }

  // UI-only post type marker (journal | watching)
  if (typeof mapped.ui_post_type === 'string' && VALID_UI_POST_TYPES.includes(mapped.ui_post_type)) {
    result.ui_post_type = mapped.ui_post_type as 'journal' | 'watching';
  }

  // Structured location — gated by isValidStoredLocation; normalize fields
  // so partial coordinates / blank strings don't leak into the column.
  if (isValidStoredLocation(mapped.location)) {
    const loc = mapped.location;
    const normalized: PostLocation = { name: loc.name.trim() };
    if (typeof loc.address === 'string' && loc.address.trim().length > 0) {
      normalized.address = loc.address.trim();
    }
    if (typeof loc.place_id === 'string' && loc.place_id.trim().length > 0) {
      normalized.place_id = loc.place_id.trim();
    }
    if (loc.coordinates && typeof loc.coordinates.lat === 'number' && typeof loc.coordinates.lng === 'number') {
      normalized.coordinates = { lat: loc.coordinates.lat, lng: loc.coordinates.lng };
    }
    result.location = normalized;
  }

  // Return null if no fields have values (don't store { "_v": 1 } alone)
  if (Object.keys(result).length === 0) return null;

  return { ...result, _v: 1 } as StructuredFields;
}

/**
 * Returns true if the data has at least one renderable structured field.
 */
export function hasStructuredContent(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return ALLOWED_STRUCTURED_KEYS.some(
    (key) => data[key] !== undefined && data[key] !== null && data[key] !== ''
  );
}
