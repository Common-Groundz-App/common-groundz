/**
 * Structured Experience Fields — Phase 3
 * Types, constants, and cleaning utilities for structured post data.
 */

export interface StructuredFields {
  what_worked?: string;
  what_didnt?: string;
  duration?: string;
  good_for?: string;
  reuse_intent?: 'yes' | 'no';
  _v: number;
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
] as const;

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
