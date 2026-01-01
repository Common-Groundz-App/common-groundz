// Phase 6.0: Unified Dynamic Preferences Types - Canonical Schema

// ============= Intent Types =============
export type ConstraintIntent = 'strictly_avoid' | 'avoid' | 'limit' | 'prefer';
// Simplified MVP intent for unified constraints
export type UnifiedConstraintIntent = 'avoid' | 'strictly_avoid';
export type PreferenceIntent = 'like' | 'dislike' | 'neutral';

// ============= Source & Priority Types =============
export type PreferencePriority = 'constraint' | 'user' | 'chatbot';
export type PreferenceSource = 'form' | 'chatbot' | 'manual' | 'explicit_user_confirmation';

// ============= Canonical Category Type =============
export type CanonicalCategory =
  | 'skin_type'
  | 'hair_type'
  | 'food_preferences'
  | 'lifestyle'
  | 'genre_preferences'
  | 'goals';

// ============= Unified Constraint Types (MVP) =============
// IMPORTANT: Do not add more target types until current ones are fully utilized
// Current MVP types are expressive enough for: ingredients, brands, genres, food types, formats, rules
export type ConstraintTargetType = 'ingredient' | 'brand' | 'genre' | 'food_type' | 'format' | 'rule';

// Scope determines where the constraint applies
// 'global' = applies everywhere, domain-specific = only in that domain
export type ConstraintScope = 'global' | 'skincare' | 'haircare' | 'food' | 'entertainment' | 'supplements' | 'wellness';

// ============= Unified Constraint (Entity-Based with Scope) =============
export interface UnifiedConstraint {
  id: string;
  targetType: ConstraintTargetType;
  targetValue: string;           // Display value (original casing)
  normalizedValue: string;       // Lowercase, trimmed (for deduplication)
  scope: ConstraintScope;        // Where this constraint applies
  appliesTo?: string[];          // Optional: narrow to specific domains ['skincare', 'supplements']
  intent: UnifiedConstraintIntent;
  source: 'manual' | 'chatbot' | 'explicit_user_confirmation';
  createdAt: string;             // ISO timestamp
  // Future fields (staged for v2)
  // confidence?: number;
  // evidence?: string;
}

// ============= Unified Constraints Container =============
export interface UnifiedConstraintsType {
  items: UnifiedConstraint[];
  budget?: 'affordable' | 'mid-range' | 'premium' | 'no_preference';
}

// ============= Core Preference Value (Canonical Shape) =============
export interface PreferenceValue {
  value: string;           // Display value (original casing)
  normalizedValue: string; // Lowercase, trimmed (for deduplication)
  source: PreferenceSource;
  intent?: PreferenceIntent; // Default: 'like' for preferences
  confidence?: number;     // AI confidence at approval time (0-1)
  evidence?: string;       // AI evidence/context
  addedAt: string;         // ISO timestamp
}

// ============= Preference Category Container =============
export interface PreferenceCategory {
  values: PreferenceValue[];
}

// ============= Legacy Constraint Types (for migration, deprecated) =============
/** @deprecated Use UnifiedConstraint instead */
export interface CustomConstraint {
  id: string;
  category: string;
  rule: string;
  value: string;
  intent: ConstraintIntent;
  source: 'manual' | 'chatbot';
  confidence: number;
  evidence?: string;
  createdAt: string;
}

/** @deprecated Use UnifiedConstraintsType instead */
export interface ConstraintsType {
  avoidIngredients?: string[];
  avoidBrands?: string[];
  budget?: 'affordable' | 'mid-range' | 'premium' | 'no_preference';
  avoidProductForms?: string[];
  custom?: CustomConstraint[];
}

// ============= Legacy Types (for migration) =============
export interface CustomPreference {
  id: string;
  category: string;
  key: string;
  value: string;
  source: PreferenceSource;
  confidence: number;
  priority: PreferencePriority;
  needsReview?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearnedPreference {
  id?: string;  // Unique identifier for stable matching (rule:value format)
  scope: string;
  key: string;
  value: any;
  confidence: number;
  evidence?: string;
  extractedAt: string;
  dismissed?: boolean;
  approvedAt?: string;
  // Constraint-specific metadata (preserved from detection)
  constraintRule?: string;           // e.g., "Avoid ingredient"
  constraintIntent?: ConstraintIntent; // e.g., "avoid" | "strictly_avoid"
}

export interface DetectedConstraint {
  category: string;
  rule: string;
  value: string;
  intent: ConstraintIntent;
  confidence: number;
  evidence?: string;
}

export interface DetectedPreference {
  category: string;
  key: string;
  value: string;
  confidence: number;
  evidence?: string;
}

// ============= User Preferences (Canonical Shape) =============
export interface UserPreferences {
  // Canonical preference categories (new shape)
  skin_type?: PreferenceCategory;
  hair_type?: PreferenceCategory;
  food_preferences?: PreferenceCategory;
  lifestyle?: PreferenceCategory;
  genre_preferences?: PreferenceCategory;
  goals?: PreferenceCategory;
  
  // Dynamic custom categories for AI-discovered categories
  custom_categories?: Record<string, PreferenceCategory>;
  
  // Constraints (unchanged - already well-structured)
  constraints?: ConstraintsType;
  
  // Legacy fields (deprecated, for migration only)
  /** @deprecated Use canonical PreferenceCategory shape instead */
  other_skin_type?: string;
  /** @deprecated Use canonical PreferenceCategory shape instead */
  other_hair_type?: string;
  /** @deprecated Use canonical PreferenceCategory shape instead */
  other_food_preferences?: string;
  /** @deprecated Use canonical PreferenceCategory shape instead */
  other_lifestyle?: string;
  /** @deprecated Use canonical PreferenceCategory shape instead */
  other_genre_preferences?: string;
  /** @deprecated Use custom_categories instead */
  custom_preferences?: CustomPreference[];
  
  // Metadata
  last_updated?: string;
  onboarding_completed?: boolean;
}

// ============= Intent Badge Colors for UI =============
export const INTENT_COLORS: Record<ConstraintIntent, { bg: string; text: string; label: string }> = {
  strictly_avoid: { bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400', label: 'Never' },
  avoid: { bg: 'bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', label: 'Avoid' },
  limit: { bg: 'bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', label: 'Limit' },
  prefer: { bg: 'bg-green-500/20', text: 'text-green-600 dark:text-green-400', label: 'Prefer' },
};

// ============= Confidence Level Helpers =============
export const getConfidenceLevel = (confidence: number): { label: string; color: string } => {
  if (confidence >= 0.8) return { label: 'High', color: 'text-green-600' };
  if (confidence >= 0.5) return { label: 'Medium', color: 'text-yellow-600' };
  return { label: 'Low', color: 'text-red-600' };
};

// ============= Category Options for UI =============
export const PREFERENCE_CATEGORIES = [
  'skincare',
  'haircare',
  'food',
  'movies',
  'books',
  'fitness',
  'places',
  'courses',
  'lifestyle',
  'other'
] as const;

export type PreferenceCategoryOption = typeof PREFERENCE_CATEGORIES[number];

// ============= Canonical Categories List =============
export const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  'skin_type',
  'hair_type',
  'food_preferences',
  'lifestyle',
  'genre_preferences',
  'goals',
];
