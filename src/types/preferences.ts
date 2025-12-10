// Phase 6.0: Unified Dynamic Preferences Types

export type ConstraintIntent = 'strictly_avoid' | 'avoid' | 'limit' | 'prefer';

export type PreferencePriority = 'constraint' | 'user' | 'chatbot';

export type PreferenceSource = 'manual' | 'chatbot' | 'form';

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

export interface ConstraintsType {
  avoidIngredients?: string[];
  avoidBrands?: string[];
  budget?: 'affordable' | 'mid-range' | 'premium' | 'no_preference';
  avoidProductForms?: string[];
  custom?: CustomConstraint[];
}

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
  scope: string;
  key: string;
  value: any;
  confidence: number;
  evidence?: string;
  extractedAt: string;
  dismissed?: boolean;
  approvedAt?: string;
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

export interface UserPreferences {
  // Form-based preferences (existing)
  skin_type?: string[];
  other_skin_type?: string;
  hair_type?: string[];
  other_hair_type?: string;
  food_preferences?: string[];
  other_food_preferences?: string;
  lifestyle?: string[];
  other_lifestyle?: string;
  genre_preferences?: string[];
  other_genre_preferences?: string;
  goals?: string[];
  
  // Constraints (Phase 6.0)
  constraints?: ConstraintsType;
  
  // Custom preferences (Phase 6.0)
  custom_preferences?: CustomPreference[];
  
  // Metadata
  last_updated?: string;
  onboarding_completed?: boolean;
}

// Intent badge colors for UI
export const INTENT_COLORS: Record<ConstraintIntent, { bg: string; text: string; label: string }> = {
  strictly_avoid: { bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400', label: 'Never' },
  avoid: { bg: 'bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', label: 'Avoid' },
  limit: { bg: 'bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', label: 'Limit' },
  prefer: { bg: 'bg-green-500/20', text: 'text-green-600 dark:text-green-400', label: 'Prefer' },
};

// Confidence level helpers
export const getConfidenceLevel = (confidence: number): { label: string; color: string } => {
  if (confidence >= 0.8) return { label: 'High', color: 'text-green-600' };
  if (confidence >= 0.5) return { label: 'Medium', color: 'text-yellow-600' };
  return { label: 'Low', color: 'text-red-600' };
};

// Category options for custom constraints/preferences
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

export type PreferenceCategory = typeof PREFERENCE_CATEGORIES[number];
