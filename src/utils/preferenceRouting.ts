// Preference Routing Utilities - Canonical Schema
// Handles normalization, routing, and value creation for preferences

import { 
  CanonicalCategory, 
  PreferenceValue, 
  PreferenceSource, 
  PreferenceIntent,
  PreferenceCategory,
  UserPreferences
} from '@/types/preferences';

// ============= Constants =============

/** Minimum confidence required for auto-routing AI preferences */
export const MIN_AUTO_ROUTE_CONFIDENCE = 0.6;

/** Deterministic routing map from AI categories to canonical fields */
export const CATEGORY_ROUTING_MAP: Record<string, CanonicalCategory> = {
  // Food-related
  'food': 'food_preferences',
  'cuisine': 'food_preferences',
  'diet': 'food_preferences',
  'dietary': 'food_preferences',
  'eating': 'food_preferences',
  
  // Skin-related
  'skin': 'skin_type',
  'skincare': 'skin_type',
  'skin_type': 'skin_type',
  
  // Hair-related
  'hair': 'hair_type',
  'haircare': 'hair_type',
  'hair_type': 'hair_type',
  
  // Entertainment-related
  'movies': 'genre_preferences',
  'books': 'genre_preferences',
  'entertainment': 'genre_preferences',
  'genres': 'genre_preferences',
  'genre': 'genre_preferences',
  'genre_preferences': 'genre_preferences',
  
  // Lifestyle-related
  'lifestyle': 'lifestyle',
  'fitness': 'lifestyle',
  'routines': 'lifestyle',
  'habits': 'lifestyle',
  
  // Goals-related
  'goals': 'goals',
  'objectives': 'goals',
  'targets': 'goals',
};

// ============= Normalization =============

/**
 * Normalize a preference value for deduplication.
 * Trims whitespace and converts to lowercase.
 */
export function normalizePreferenceValue(value: string): string {
  return value.trim().toLowerCase();
}

// ============= Routing =============

/**
 * Route an AI category to a canonical field.
 * Returns null if no mapping exists (should go to custom_categories).
 */
export function routePreference(category: string): CanonicalCategory | null {
  const normalized = category.toLowerCase().trim().replace(/[^a-z_]/g, '');
  return CATEGORY_ROUTING_MAP[normalized] || null;
}

/**
 * Check if a category maps to a canonical field.
 */
export function isCanonicalCategory(category: string): boolean {
  return routePreference(category) !== null;
}

// ============= Value Creation =============

/**
 * Create a new PreferenceValue with automatic normalization.
 */
export function createPreferenceValue(
  value: string,
  source: PreferenceSource,
  intent: PreferenceIntent = 'like',
  confidence?: number,
  evidence?: string
): PreferenceValue {
  return {
    value: value.trim(),
    normalizedValue: normalizePreferenceValue(value),
    source,
    intent,
    confidence,
    evidence,
    addedAt: new Date().toISOString(),
  };
}

/**
 * Create multiple PreferenceValues from an array of strings.
 * Filters out "other" values - they are UI affordances, not preferences.
 */
export function createPreferenceValues(
  values: string[],
  source: PreferenceSource,
  intent: PreferenceIntent = 'like'
): PreferenceValue[] {
  return values
    .filter(v => v.trim().toLowerCase() !== 'other')
    .map(v => createPreferenceValue(v, source, intent));
}

// ============= Deduplication =============

/**
 * Check if a value already exists in a PreferenceCategory (by normalizedValue).
 */
export function valueExistsInCategory(
  category: PreferenceCategory | undefined,
  normalizedValue: string
): boolean {
  if (!category?.values) return false;
  return category.values.some(v => v.normalizedValue === normalizedValue);
}

/**
 * Add a value to a PreferenceCategory if it doesn't already exist.
 * Returns the updated category.
 */
export function addValueToCategory(
  category: PreferenceCategory | undefined,
  newValue: PreferenceValue
): PreferenceCategory {
  const existing = category?.values || [];
  
  // Check for duplicates
  if (existing.some(v => v.normalizedValue === newValue.normalizedValue)) {
    return { values: existing };
  }
  
  return { values: [...existing, newValue] };
}

/**
 * Remove a value from a PreferenceCategory by normalizedValue.
 */
export function removeValueFromCategory(
  category: PreferenceCategory | undefined,
  normalizedValue: string
): PreferenceCategory {
  if (!category?.values) return { values: [] };
  return {
    values: category.values.filter(v => v.normalizedValue !== normalizedValue)
  };
}

/**
 * Merge new values into a PreferenceCategory, avoiding duplicates.
 */
export function mergeValuesIntoCategory(
  category: PreferenceCategory | undefined,
  newValues: PreferenceValue[]
): PreferenceCategory {
  let result = category || { values: [] };
  for (const value of newValues) {
    result = addValueToCategory(result, value);
  }
  return result;
}

// ============= Migration Helpers =============

/**
 * Check if preferences are in the legacy format (arrays instead of PreferenceCategory).
 */
export function isLegacyFormat(prefs: any): boolean {
  if (!prefs) return false;
  
  // Check if any canonical field is an array (legacy) instead of PreferenceCategory
  const canonicalFields = ['skin_type', 'hair_type', 'food_preferences', 'lifestyle', 'genre_preferences', 'goals'];
  
  for (const field of canonicalFields) {
    const value = prefs[field];
    if (Array.isArray(value)) {
      return true;
    }
    // Also check for other_* fields
    if (prefs[`other_${field.replace('_type', '_type').replace('_preferences', '')}`]) {
      return true;
    }
  }
  
  return false;
}

/**
 * Migrate legacy preferences to canonical format.
 * Handles both old array format and other_* fields.
 */
export function migratePreferencesToCanonical(oldPrefs: any): UserPreferences {
  if (!oldPrefs) return {};
  
  // If already in new format, return as-is
  if (!isLegacyFormat(oldPrefs)) {
    return oldPrefs as UserPreferences;
  }
  
  const newPrefs: UserPreferences = {
    constraints: oldPrefs.constraints,
    last_updated: oldPrefs.last_updated,
    onboarding_completed: oldPrefs.onboarding_completed,
  };
  
  // Helper to migrate a single field
  const migrateField = (
    fieldName: CanonicalCategory,
    otherFieldName?: string
  ): PreferenceCategory | undefined => {
    const values: PreferenceValue[] = [];
    
    // Handle main array/PreferenceCategory
    const mainValue = oldPrefs[fieldName];
    if (mainValue) {
      if (Array.isArray(mainValue)) {
        // Legacy array format - filter out "other"
        for (const v of mainValue) {
          if (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'other') {
            values.push(createPreferenceValue(v, 'form', 'like'));
          }
        }
      } else if (mainValue.values && Array.isArray(mainValue.values)) {
        // Already in new format
        values.push(...mainValue.values);
      }
    }
    
    // Handle other_* field (legacy) - filter out "other"
    if (otherFieldName && oldPrefs[otherFieldName]) {
      const otherValue = oldPrefs[otherFieldName];
      if (typeof otherValue === 'string' && otherValue.trim()) {
        // Split by comma if multiple values, filter out "other"
        const otherValues = otherValue.split(',')
          .map((v: string) => v.trim())
          .filter(Boolean)
          .filter(v => v.toLowerCase() !== 'other');
        for (const v of otherValues) {
          if (!values.some(existing => existing.normalizedValue === normalizePreferenceValue(v))) {
            values.push(createPreferenceValue(v, 'form', 'like'));
          }
        }
      }
    }
    
    return values.length > 0 ? { values } : undefined;
  };
  
  // Migrate each canonical field
  newPrefs.skin_type = migrateField('skin_type', 'other_skin_type');
  newPrefs.hair_type = migrateField('hair_type', 'other_hair_type');
  newPrefs.food_preferences = migrateField('food_preferences', 'other_food_preferences');
  newPrefs.lifestyle = migrateField('lifestyle', 'other_lifestyle');
  newPrefs.genre_preferences = migrateField('genre_preferences', 'other_genre_preferences');
  newPrefs.goals = migrateField('goals');
  
  // Migrate custom_preferences to custom_categories if they exist
  if (oldPrefs.custom_preferences?.length > 0) {
    const customCategories: Record<string, PreferenceCategory> = {};
    
    for (const cp of oldPrefs.custom_preferences) {
      const categoryKey = cp.category || 'other';
      const targetField = routePreference(categoryKey);
      
      if (targetField && newPrefs[targetField]) {
        // Route to canonical field
        const newValue = createPreferenceValue(
          cp.value,
          cp.source || 'chatbot',
          'like',
          cp.confidence
        );
        newPrefs[targetField] = addValueToCategory(newPrefs[targetField], newValue);
      } else {
        // Route to custom_categories
        if (!customCategories[categoryKey]) {
          customCategories[categoryKey] = { values: [] };
        }
        const newValue = createPreferenceValue(
          cp.value,
          cp.source || 'chatbot',
          'like',
          cp.confidence
        );
        customCategories[categoryKey] = addValueToCategory(customCategories[categoryKey], newValue);
      }
    }
    
    if (Object.keys(customCategories).length > 0) {
      newPrefs.custom_categories = customCategories;
    }
  }
  
  return newPrefs;
}

// ============= Display Helpers =============

/**
 * Get all values from a PreferenceCategory as a flat string array.
 */
export function getCategoryValues(category: PreferenceCategory | undefined): string[] {
  if (!category?.values) return [];
  return category.values.map(v => v.value);
}

/**
 * Get the display value for a preference (original casing).
 */
export function getDisplayValue(pref: PreferenceValue): string {
  return pref.value;
}

/**
 * Check if a preference was added by AI.
 */
export function isAISource(pref: PreferenceValue): boolean {
  return pref.source === 'chatbot';
}

/**
 * Count total preferences across all canonical categories.
 * Excludes "other" values as they are UI affordances, not real preferences.
 */
export function countTotalPreferences(prefs: UserPreferences): number {
  // Helper to count values excluding "other"
  const countValues = (values: PreferenceValue[] | undefined): number => {
    if (!values) return 0;
    return values.filter(v => v.normalizedValue !== 'other').length;
  };
  
  let count = 0;
  
  count += countValues(prefs.skin_type?.values);
  count += countValues(prefs.hair_type?.values);
  count += countValues(prefs.food_preferences?.values);
  count += countValues(prefs.lifestyle?.values);
  count += countValues(prefs.genre_preferences?.values);
  count += countValues(prefs.goals?.values);
  
  // Count custom categories
  if (prefs.custom_categories) {
    for (const cat of Object.values(prefs.custom_categories)) {
      count += countValues(cat?.values);
    }
  }
  
  return count;
}

/**
 * Check if preferences have any values set.
 */
export function hasAnyPreferences(prefs: UserPreferences): boolean {
  return countTotalPreferences(prefs) > 0;
}
