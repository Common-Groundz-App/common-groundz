// Preference Utilities - Deep Equality and Difference Counting
// Used by PreferencesSection for draft-based Save/Cancel system

import { 
  PreferenceCategory, 
  PreferenceValue, 
  UserPreferences, 
  CanonicalCategory 
} from '@/types/preferences';

// ============= Constants =============

const CANONICAL_FIELDS: CanonicalCategory[] = [
  'skin_type', 
  'hair_type', 
  'food_preferences', 
  'lifestyle', 
  'genre_preferences', 
  'goals'
];

// ============= Deep Equality =============

/**
 * Compare two PreferenceCategory objects for equality.
 * Uses normalized values for comparison (order-independent).
 */
export function areCategoriesEqual(
  a: PreferenceCategory | undefined, 
  b: PreferenceCategory | undefined
): boolean {
  // Both undefined or null
  if (!a && !b) return true;
  // One undefined, one exists
  if (!a || !b) return false;
  
  const aValues = a.values || [];
  const bValues = b.values || [];
  
  // Different lengths = not equal
  if (aValues.length !== bValues.length) return false;
  
  // Create sets of normalized values for order-independent comparison
  const aNormalized = new Set(aValues.map(v => v.normalizedValue));
  const bNormalized = new Set(bValues.map(v => v.normalizedValue));
  
  // Check every value in A exists in B
  for (const val of aNormalized) {
    if (!bNormalized.has(val)) return false;
  }
  
  return true;
}

/**
 * Compare two UserPreferences objects for equality.
 * Compares all canonical categories and custom categories.
 */
export function arePreferencesEqual(
  a: UserPreferences, 
  b: UserPreferences
): boolean {
  // Compare canonical categories
  for (const field of CANONICAL_FIELDS) {
    if (!areCategoriesEqual(a[field], b[field])) {
      return false;
    }
  }
  
  // Compare custom categories
  const aCustomKeys = Object.keys(a.custom_categories || {});
  const bCustomKeys = Object.keys(b.custom_categories || {});
  
  // Different number of custom categories
  if (aCustomKeys.length !== bCustomKeys.length) return false;
  
  // Check each custom category
  for (const key of aCustomKeys) {
    if (!areCategoriesEqual(
      a.custom_categories?.[key], 
      b.custom_categories?.[key]
    )) {
      return false;
    }
  }
  
  return true;
}

// ============= Difference Counting =============

/**
 * Count the differences between two PreferenceCategory objects.
 * Returns the number of added and removed values.
 */
export function countCategoryDifferences(
  live: PreferenceCategory | undefined,
  draft: PreferenceCategory | undefined
): { added: number; removed: number } {
  const liveVals = new Set((live?.values || []).map(v => v.normalizedValue));
  const draftVals = new Set((draft?.values || []).map(v => v.normalizedValue));
  
  let added = 0;
  let removed = 0;
  
  // Count removed: in live but not in draft
  for (const val of liveVals) {
    if (!draftVals.has(val)) removed++;
  }
  
  // Count added: in draft but not in live
  for (const val of draftVals) {
    if (!liveVals.has(val)) added++;
  }
  
  return { added, removed };
}

/**
 * Count all differences between live and draft preferences.
 * Returns total added and removed across all categories.
 */
export function countPreferenceDifferences(
  live: UserPreferences, 
  draft: UserPreferences
): { added: number; removed: number } {
  let totalAdded = 0;
  let totalRemoved = 0;
  
  // Compare canonical categories
  for (const field of CANONICAL_FIELDS) {
    const { added, removed } = countCategoryDifferences(live[field], draft[field]);
    totalAdded += added;
    totalRemoved += removed;
  }
  
  // Compare custom categories
  const allCustomKeys = new Set([
    ...Object.keys(live.custom_categories || {}),
    ...Object.keys(draft.custom_categories || {})
  ]);
  
  for (const key of allCustomKeys) {
    const { added, removed } = countCategoryDifferences(
      live.custom_categories?.[key],
      draft.custom_categories?.[key]
    );
    totalAdded += added;
    totalRemoved += removed;
  }
  
  return { added: totalAdded, removed: totalRemoved };
}

// ============= Pending State Helpers =============

/**
 * Check if a specific preference value is pending removal.
 * Returns true if the value exists in live but not in draft.
 */
export function isPendingRemoval(
  live: UserPreferences,
  draft: UserPreferences,
  field: string,
  normalizedValue: string
): boolean {
  const canonicalFields = CANONICAL_FIELDS as readonly string[];
  
  let liveCategory: PreferenceCategory | undefined;
  let draftCategory: PreferenceCategory | undefined;
  
  if (canonicalFields.includes(field)) {
    liveCategory = live[field as CanonicalCategory];
    draftCategory = draft[field as CanonicalCategory];
  } else {
    liveCategory = live.custom_categories?.[field];
    draftCategory = draft.custom_categories?.[field];
  }
  
  const existsInLive = liveCategory?.values?.some(v => v.normalizedValue === normalizedValue) ?? false;
  const existsInDraft = draftCategory?.values?.some(v => v.normalizedValue === normalizedValue) ?? false;
  
  return existsInLive && !existsInDraft;
}

/**
 * Generate a human-readable change summary.
 */
export function getChangeSummary(added: number, removed: number): string {
  if (added > 0 && removed > 0) {
    return `${added} added, ${removed} removed`;
  }
  if (removed > 0) {
    return `${removed} preference${removed > 1 ? 's' : ''} will be removed`;
  }
  if (added > 0) {
    return `${added} preference${added > 1 ? 's' : ''} will be added`;
  }
  return '';
}
