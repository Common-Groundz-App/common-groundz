// ============= Unified Constraint Utilities =============
// ALL constraint mutations MUST go through these functions

import {
  UnifiedConstraint,
  UnifiedConstraintsType,
  ConstraintTargetType,
  ConstraintScope,
  UnifiedConstraintIntent,
  ConstraintsType,
  CustomConstraint,
} from '@/types/preferences';

// ============= Scope Default Rules =============
// Ingredients & Brands → global (safe defaults)
// Genres, food types, formats, rules → domain-specific or inferred

export const getDefaultScope = (targetType: ConstraintTargetType): ConstraintScope => {
  switch (targetType) {
    case 'ingredient':
    case 'brand':
      return 'global';
    case 'genre':
      return 'entertainment';
    case 'food_type':
      return 'food';
    case 'format':
      return 'skincare'; // Default, can be overridden
    case 'rule':
      return 'global';
    default:
      return 'global';
  }
};

// ============= Normalization =============
export const normalizeConstraintValue = (value: string): string => {
  return value.toLowerCase().trim();
};

// ============= MUTATION FUNCTIONS (Only ways to modify constraints) =============

/**
 * Create a new unified constraint
 * This is the ONLY way to create constraints
 */
export const createUnifiedConstraint = (
  targetType: ConstraintTargetType,
  targetValue: string,
  options?: {
    scope?: ConstraintScope;
    appliesTo?: string[];
    intent?: UnifiedConstraintIntent;
    source?: 'manual' | 'chatbot';
  }
): UnifiedConstraint => {
  const defaultScope = getDefaultScope(targetType);
  
  return {
    id: crypto.randomUUID(),
    targetType,
    targetValue,
    normalizedValue: normalizeConstraintValue(targetValue),
    scope: options?.scope ?? defaultScope,
    appliesTo: options?.appliesTo,
    intent: options?.intent ?? 'avoid',
    source: options?.source ?? 'manual',
    createdAt: new Date().toISOString(),
  };
};

/**
 * Add a constraint to the constraints list
 * Prevents duplicates based on normalizedValue + targetType + scope
 */
export const addUnifiedConstraint = (
  current: UnifiedConstraintsType,
  constraint: UnifiedConstraint
): UnifiedConstraintsType => {
  const isDuplicate = current.items.some(
    c => c.normalizedValue === constraint.normalizedValue &&
         c.targetType === constraint.targetType &&
         c.scope === constraint.scope
  );
  
  if (isDuplicate) {
    return current;
  }
  
  return {
    ...current,
    items: [...current.items, constraint],
  };
};

/**
 * Remove a constraint by ID
 */
export const removeUnifiedConstraint = (
  current: UnifiedConstraintsType,
  constraintId: string
): UnifiedConstraintsType => {
  return {
    ...current,
    items: current.items.filter(c => c.id !== constraintId),
  };
};

/**
 * Update a constraint by ID
 */
export const updateUnifiedConstraint = (
  current: UnifiedConstraintsType,
  constraintId: string,
  updates: Partial<Omit<UnifiedConstraint, 'id' | 'createdAt'>>
): UnifiedConstraintsType => {
  return {
    ...current,
    items: current.items.map(c => 
      c.id === constraintId 
        ? { ...c, ...updates, normalizedValue: updates.targetValue ? normalizeConstraintValue(updates.targetValue) : c.normalizedValue }
        : c
    ),
  };
};

// ============= READ-ONLY FUNCTIONS (For category views) =============

// Category definitions for display
export interface ConstraintCategory {
  id: string;
  name: string;
  emoji: string;
  targetTypes: ConstraintTargetType[];
  scopes: ConstraintScope[];
}

export const CONSTRAINT_CATEGORIES: ConstraintCategory[] = [
  { id: 'skincare', name: 'Skincare', emoji: '🧴', targetTypes: ['ingredient', 'brand', 'format'], scopes: ['global', 'skincare'] },
  { id: 'haircare', name: 'Haircare', emoji: '💇', targetTypes: ['ingredient', 'brand', 'format'], scopes: ['global', 'haircare'] },
  { id: 'food', name: 'Food', emoji: '🍽️', targetTypes: ['ingredient', 'brand', 'food_type'], scopes: ['global', 'food'] },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', targetTypes: ['genre', 'rule'], scopes: ['global', 'entertainment'] },
  { id: 'supplements', name: 'Supplements', emoji: '💊', targetTypes: ['ingredient', 'brand'], scopes: ['global', 'supplements', 'wellness'] },
  { id: 'brands', name: 'Brands', emoji: '🏷️', targetTypes: ['brand'], scopes: ['global'] },
  { id: 'formats', name: 'Formats', emoji: '📦', targetTypes: ['format'], scopes: ['global', 'skincare', 'haircare'] },
  { id: 'other', name: 'General', emoji: '📋', targetTypes: ['rule'], scopes: ['global'] },
];

/**
 * DISPLAY ONLY - Determines the single category where a constraint should be visually rendered.
 * 
 * GUARDRAILS:
 * 1. This function must be PURE and DETERMINISTIC - no side effects, no UI state dependencies
 * 2. NEVER use this for enforcement/filtering logic - use scope/appliesTo/intent directly
 * 
 * Resolution order:
 * 1. appliesTo[0] if explicitly set (single domain)
 * 2. scope if domain-specific (not 'global')
 * 3. Default mapping by targetType
 */
export const getPrimaryCategory = (constraint: UnifiedConstraint): string => {
  // Priority 1: Explicit appliesTo (if single domain)
  if (constraint.appliesTo?.length === 1) {
    return constraint.appliesTo[0];
  }
  
  // Priority 2: Domain-specific scope (not global)
  if (constraint.scope !== 'global') {
    return constraint.scope;
  }
  
  // Priority 3: Default by targetType (deterministic mapping)
  switch (constraint.targetType) {
    case 'ingredient': return 'skincare';
    case 'brand': return 'brands';
    case 'format': return 'formats';
    case 'genre': return 'entertainment';
    case 'food_type': return 'food';
    case 'rule': return 'other';
    default: return 'other';
  }
};

/**
 * Check if a constraint should appear in a category view
 * FOR ENFORCEMENT: Use scope/appliesTo/intent directly, not this function
 */
export const constraintAppliesToCategory = (
  constraint: UnifiedConstraint,
  category: ConstraintCategory
): boolean => {
  // Check if appliesTo explicitly includes this category
  if (constraint.appliesTo && constraint.appliesTo.length > 0) {
    return constraint.appliesTo.includes(category.id);
  }
  
  // Check target type matches
  const typeMatches = category.targetTypes.includes(constraint.targetType);
  
  // Check scope matches (global applies everywhere)
  const scopeMatches = constraint.scope === 'global' || category.scopes.includes(constraint.scope);
  
  return typeMatches && scopeMatches;
};

/**
 * Get all constraints that should display in a category.
 * Uses PRIMARY CATEGORY to prevent duplication - each constraint appears in ONE category only.
 */
export const getConstraintsForCategory = (
  constraints: UnifiedConstraintsType,
  categoryId: string
): UnifiedConstraint[] => {
  if (!constraints?.items?.length) return [];
  
  // Use primary category for display (prevents duplication)
  return constraints.items.filter(constraint => 
    getPrimaryCategory(constraint) === categoryId
  );
};

/**
 * Get all categories that have constraints
 */
export const getCategoriesWithConstraints = (
  constraints: UnifiedConstraintsType
): ConstraintCategory[] => {
  return CONSTRAINT_CATEGORIES.filter(
    category => getConstraintsForCategory(constraints, category.id).length > 0
  );
};

/**
 * Count total constraints (budget not included - budget is not a constraint)
 */
export const countConstraints = (constraints: UnifiedConstraintsType): number => {
  return constraints?.items?.length ?? 0;
};

// ============= MIGRATION FUNCTIONS =============

/**
 * Check if constraints are in legacy format
 */
export const isLegacyConstraintFormat = (constraints: any): constraints is ConstraintsType => {
  if (!constraints) return false;
  return (
    Array.isArray(constraints.avoidIngredients) ||
    Array.isArray(constraints.avoidBrands) ||
    Array.isArray(constraints.avoidProductForms) ||
    Array.isArray(constraints.custom)
  );
};

/**
 * Migrate legacy constraints to unified format
 */
export const migrateToUnifiedConstraints = (
  legacy: ConstraintsType | undefined
): UnifiedConstraintsType => {
  if (!legacy) {
    return { items: [], budget: 'no_preference' };
  }
  
  const items: UnifiedConstraint[] = [];
  
  // Migrate avoidIngredients
  if (legacy.avoidIngredients) {
    legacy.avoidIngredients.forEach(ingredient => {
      items.push(createUnifiedConstraint('ingredient', ingredient, {
        scope: 'global',
        intent: 'avoid',
        source: 'manual',
      }));
    });
  }
  
  // Migrate avoidBrands
  if (legacy.avoidBrands) {
    legacy.avoidBrands.forEach(brand => {
      items.push(createUnifiedConstraint('brand', brand, {
        scope: 'global',
        intent: 'avoid',
        source: 'manual',
      }));
    });
  }
  
  // Migrate avoidProductForms
  if (legacy.avoidProductForms) {
    legacy.avoidProductForms.forEach(form => {
      items.push(createUnifiedConstraint('format', form, {
        scope: 'global',
        intent: 'avoid',
        source: 'manual',
      }));
    });
  }
  
  // Migrate custom constraints
  if (legacy.custom) {
    legacy.custom.forEach((custom: CustomConstraint) => {
      // Infer target type from rule/category
      let targetType: ConstraintTargetType = 'rule';
      let scope: ConstraintScope = 'global';
      
      const ruleLC = custom.rule.toLowerCase();
      const categoryLC = custom.category.toLowerCase();
      
      if (ruleLC.includes('ingredient') || ruleLC.includes('avoid') && !ruleLC.includes('genre')) {
        targetType = 'ingredient';
      } else if (ruleLC.includes('brand')) {
        targetType = 'brand';
      } else if (ruleLC.includes('genre')) {
        targetType = 'genre';
        scope = 'entertainment';
      } else if (ruleLC.includes('format') || ruleLC.includes('form')) {
        targetType = 'format';
      } else if (categoryLC.includes('food') || categoryLC.includes('diet')) {
        targetType = 'food_type';
        scope = 'food';
      }
      
      // Map legacy intent to unified intent
      const intent: UnifiedConstraintIntent = 
        custom.intent === 'strictly_avoid' ? 'strictly_avoid' : 'avoid';
      
      items.push({
        id: custom.id,
        targetType,
        targetValue: custom.value,
        normalizedValue: normalizeConstraintValue(custom.value),
        scope,
        intent,
        source: custom.source,
        createdAt: custom.createdAt,
      });
    });
  }
  
  return {
    items,
    budget: legacy.budget,
  };
};

/**
 * Convert unified constraints back to legacy format (for backward compatibility)
 */
export const convertToLegacyFormat = (unified: UnifiedConstraintsType): ConstraintsType => {
  const legacy: ConstraintsType = {
    avoidIngredients: [],
    avoidBrands: [],
    avoidProductForms: [],
    custom: [],
    budget: unified.budget,
  };
  
  unified.items.forEach(constraint => {
    if (constraint.targetType === 'ingredient') {
      legacy.avoidIngredients?.push(constraint.targetValue);
    } else if (constraint.targetType === 'brand') {
      legacy.avoidBrands?.push(constraint.targetValue);
    } else if (constraint.targetType === 'format') {
      legacy.avoidProductForms?.push(constraint.targetValue);
    } else {
      // Convert to custom constraint
      legacy.custom?.push({
        id: constraint.id,
        category: constraint.scope,
        rule: `Avoid ${constraint.targetType}`,
        value: constraint.targetValue,
        intent: constraint.intent,
        source: constraint.source,
        confidence: 1.0,
        createdAt: constraint.createdAt,
      });
    }
  });
  
  return legacy;
};

// ============= TARGET TYPE DETECTION (for "What do you want to avoid?" flow) =============

interface DetectedConstraint {
  targetType: ConstraintTargetType;
  scope: ConstraintScope;
  confidence: number;
}

const INGREDIENT_KEYWORDS = ['vitamin', 'acid', 'retinol', 'niacinamide', 'hyaluronic', 'glycolic', 'salicylic', 'peptide', 'collagen', 'caffeine', 'alcohol', 'paraben', 'sulfate', 'silicone', 'fragrance', 'oil', 'butter', 'extract', 'sugar', 'salt', 'gluten', 'dairy', 'soy', 'nut'];
const BRAND_KEYWORDS = ['brand', 'company', 'products from'];
const GENRE_KEYWORDS = ['horror', 'comedy', 'drama', 'action', 'thriller', 'romance', 'sci-fi', 'fantasy', 'documentary', 'anime', 'musical', 'western', 'tragedy'];
const FOOD_KEYWORDS = ['food', 'fast food', 'junk food', 'processed', 'fried', 'spicy', 'sweet', 'sour', 'bitter', 'meat', 'vegetarian', 'vegan', 'organic'];
const FORMAT_KEYWORDS = ['spray', 'gel', 'cream', 'lotion', 'serum', 'oil', 'powder', 'capsule', 'tablet', 'liquid', 'foam', 'mist'];

/**
 * Detect target type from user input
 */
export const detectConstraintType = (input: string): DetectedConstraint => {
  const inputLC = input.toLowerCase();
  
  // Check for genre keywords
  if (GENRE_KEYWORDS.some(k => inputLC.includes(k))) {
    return { targetType: 'genre', scope: 'entertainment', confidence: 0.9 };
  }
  
  // Check for food keywords
  if (FOOD_KEYWORDS.some(k => inputLC.includes(k))) {
    return { targetType: 'food_type', scope: 'food', confidence: 0.85 };
  }
  
  // Check for format keywords
  if (FORMAT_KEYWORDS.some(k => inputLC.includes(k))) {
    return { targetType: 'format', scope: 'global', confidence: 0.8 };
  }
  
  // Check for ingredient keywords
  if (INGREDIENT_KEYWORDS.some(k => inputLC.includes(k))) {
    return { targetType: 'ingredient', scope: 'global', confidence: 0.85 };
  }
  
  // Check for brand keywords
  if (BRAND_KEYWORDS.some(k => inputLC.includes(k))) {
    return { targetType: 'brand', scope: 'global', confidence: 0.8 };
  }
  
  // Default to rule with lower confidence
  return { targetType: 'rule', scope: 'global', confidence: 0.5 };
};

// ============= DISPLAY HELPERS =============

export const getTargetTypeLabel = (targetType: ConstraintTargetType): string => {
  const labels: Record<ConstraintTargetType, string> = {
    ingredient: 'Ingredient',
    brand: 'Brand',
    genre: 'Genre',
    food_type: 'Food Type',
    format: 'Format',
    rule: 'Rule',
  };
  return labels[targetType];
};

export const getScopeLabel = (scope: ConstraintScope): string => {
  if (scope === 'global') return 'All categories';
  return scope.charAt(0).toUpperCase() + scope.slice(1);
};

export const getIntentLabel = (intent: UnifiedConstraintIntent): string => {
  return intent === 'strictly_avoid' ? 'Never' : 'Avoid';
};

export const getIntentStyles = (intent: UnifiedConstraintIntent): { bg: string; text: string } => {
  if (intent === 'strictly_avoid') {
    return { bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400' };
  }
  return { bg: 'bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' };
};
