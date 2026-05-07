/**
 * Structured Experience Fields — Dynamic per Post Type
 * Types, constants, config map, and cleaning utilities for structured post data.
 */

import type { DatabasePostType } from '@/components/feed/utils/postUtils';

export interface PostLocation {
  name: string;
  address?: string | null;
  place_id?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

export interface StructuredFields {
  // Shared / Experience baseline
  what_worked?: string;
  what_didnt?: string;
  duration?: string;
  good_for?: string;
  reuse_intent?: 'yes' | 'no';
  // Review
  rating?: number;
  worth_it?: 'yes' | 'no';
  recommend_intent?: 'yes' | 'no';
  // Recommendation
  why_recommend?: string;
  not_for?: string;
  // Comparison
  winner?: string;
  reasoning?: string;
  // Question
  options_considered?: string;
  what_matters?: string;
  budget?: string;
  // Tip
  tip_summary?: string;
  when_to_use?: string;
  mistakes_to_avoid?: string;
  // Meta
  location?: PostLocation;
  _v: number;
}

/**
 * Validates a stored location object.
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
  'rating',
  'worth_it',
  'recommend_intent',
  'why_recommend',
  'not_for',
  'winner',
  'reasoning',
  'options_considered',
  'what_matters',
  'budget',
  'tip_summary',
  'when_to_use',
  'mistakes_to_avoid',
  'location',
] as const;

const LEGACY_KEY_MAP: Record<string, string> = {
  pros: 'what_worked',
  cons: 'what_didnt',
  best_for: 'good_for',
};

const VALID_DURATIONS = Object.keys(DURATION_OPTIONS);
const VALID_YES_NO = ['yes', 'no'];

function trimAndCollapse(str: string): string {
  return str.trim().replace(/\s{2,}/g, ' ');
}

function enforceMaxLength(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) : str;
}

/** Max lengths per string field */
const MAX_LENGTHS: Record<string, number> = {
  what_worked: 500,
  what_didnt: 500,
  good_for: 300,
  why_recommend: 500,
  not_for: 300,
  winner: 300,
  reasoning: 500,
  options_considered: 500,
  what_matters: 300,
  budget: 100,
  tip_summary: 300,
  when_to_use: 300,
  mistakes_to_avoid: 300,
};

/** Yes/No fields */
const YES_NO_KEYS = ['reuse_intent', 'worth_it', 'recommend_intent'];

/** Narrative / free-text string fields */
const STRING_KEYS = Object.keys(MAX_LENGTHS);

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

  // String fields
  for (const key of STRING_KEYS) {
    if (typeof mapped[key] === 'string') {
      const cleaned = enforceMaxLength(trimAndCollapse(mapped[key]), MAX_LENGTHS[key]);
      if (cleaned) (result as any)[key] = cleaned;
    }
  }

  // Duration enum
  if (typeof mapped.duration === 'string' && VALID_DURATIONS.includes(mapped.duration)) {
    result.duration = mapped.duration;
  }

  // Yes/No fields
  for (const key of YES_NO_KEYS) {
    if (typeof mapped[key] === 'string' && VALID_YES_NO.includes(mapped[key])) {
      (result as any)[key] = mapped[key];
    }
  }

  // Rating — integer 1-5
  if (typeof mapped.rating === 'number' && Number.isInteger(mapped.rating) && mapped.rating >= 1 && mapped.rating <= 5) {
    result.rating = mapped.rating;
  }

  // Structured location
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

  // Return null if no fields have values
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

// ─── Config-driven field definitions per post type ───

export type FieldInputType = 'textarea' | 'text' | 'enum' | 'yesno' | 'rating';

export interface StructuredFieldConfig {
  key: string;
  label: string;
  placeholder: string;
  inputType: FieldInputType;
  maxLength?: number;
}

export const STRUCTURED_FIELDS_BY_TYPE: Record<DatabasePostType, StructuredFieldConfig[]> = {
  experience: [
    { key: 'what_worked', label: 'What worked?', placeholder: 'The best part was...', inputType: 'textarea', maxLength: 500 },
    { key: 'what_didnt', label: "What didn't work?", placeholder: 'I wish it had...', inputType: 'textarea', maxLength: 500 },
    { key: 'good_for', label: 'Good for', placeholder: 'e.g. Dry skin, Beginners, Date night', inputType: 'text', maxLength: 300 },
    { key: 'duration', label: 'How long / when did you try it?', placeholder: 'Select duration', inputType: 'enum' },
    { key: 'reuse_intent', label: 'Would you use / visit / try it again?', placeholder: '', inputType: 'yesno' },
  ],
  review: [
    { key: 'rating', label: 'Overall rating', placeholder: '', inputType: 'rating' },
    { key: 'what_worked', label: 'Pros', placeholder: 'What did you like?', inputType: 'textarea', maxLength: 500 },
    { key: 'what_didnt', label: 'Cons', placeholder: 'What could be better?', inputType: 'textarea', maxLength: 500 },
    { key: 'duration', label: 'How long / when did you try it?', placeholder: 'Select duration', inputType: 'enum' },
    { key: 'worth_it', label: 'Worth it?', placeholder: '', inputType: 'yesno' },
    { key: 'recommend_intent', label: 'Would you recommend it?', placeholder: '', inputType: 'yesno' },
  ],
  recommendation: [
    { key: 'why_recommend', label: 'Why do you recommend it?', placeholder: 'Because it...', inputType: 'textarea', maxLength: 500 },
    { key: 'good_for', label: 'Best for', placeholder: 'e.g. Beginners, Budget-conscious, Families', inputType: 'text', maxLength: 300 },
    { key: 'not_for', label: 'Not for', placeholder: 'e.g. People who prefer...', inputType: 'text', maxLength: 300 },
    { key: 'duration', label: 'How often have you used / visited / read / watched it?', placeholder: 'Select duration', inputType: 'enum' },
    { key: 'recommend_intent', label: 'Would you recommend it?', placeholder: '', inputType: 'yesno' },
  ],
  comparison: [
    { key: 'winner', label: 'Winner for you', placeholder: 'Which one did you choose?', inputType: 'text', maxLength: 300 },
    { key: 'reasoning', label: 'Why did you choose it?', placeholder: 'Because it was...', inputType: 'textarea', maxLength: 500 },
    { key: 'good_for', label: 'Best for each', placeholder: 'e.g. A is better for X, B is better for Y', inputType: 'text', maxLength: 300 },
  ],
  question: [
    { key: 'options_considered', label: "Options you're considering", placeholder: 'e.g. Option A, Option B, Option C', inputType: 'textarea', maxLength: 500 },
    { key: 'what_matters', label: 'What matters to you?', placeholder: 'e.g. Durability, Price, Ease of use', inputType: 'text', maxLength: 300 },
    { key: 'budget', label: 'Budget / constraints', placeholder: 'e.g. Under $50, No subscriptions', inputType: 'text', maxLength: 100 },
  ],
  tip: [
    { key: 'tip_summary', label: 'The tip', placeholder: 'In one line, what should someone do?', inputType: 'text', maxLength: 300 },
    { key: 'when_to_use', label: 'When should someone use this?', placeholder: 'e.g. Before buying, After switching to...', inputType: 'text', maxLength: 300 },
    { key: 'mistakes_to_avoid', label: 'Mistakes to avoid', placeholder: "e.g. Don't skip..., Make sure to...", inputType: 'text', maxLength: 300 },
    { key: 'good_for', label: 'Works best for', placeholder: 'e.g. Beginners, Budget shoppers', inputType: 'text', maxLength: 300 },
  ],
};

/**
 * Returns the structured field configs for a given post type.
 */
export function getFieldsForType(postType: DatabasePostType): StructuredFieldConfig[] {
  return STRUCTURED_FIELDS_BY_TYPE[postType] || STRUCTURED_FIELDS_BY_TYPE.experience;
}

/**
 * Returns the set of valid structured field keys for a given post type.
 * Always includes 'location' and '_v'.
 */
export function getValidKeysForType(postType: DatabasePostType): Set<string> {
  const fields = getFieldsForType(postType);
  const keys = new Set(fields.map(f => f.key));
  keys.add('location');
  keys.add('_v');
  return keys;
}

/**
 * Filters structured fields to only include keys valid for the given post type.
 */
export function filterFieldsForType(
  data: Record<string, any>,
  postType: DatabasePostType
): Record<string, any> {
  const validKeys = getValidKeysForType(postType);
  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (validKeys.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}
