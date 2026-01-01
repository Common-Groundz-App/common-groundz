import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { updateUserPreferences } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';
import { 
  UserPreferences, 
  ConstraintsType, 
  CustomConstraint, 
  LearnedPreference,
  PreferenceCategory,
  PreferenceValue,
  CanonicalCategory,
  UnifiedConstraint,
  UnifiedConstraintsType,
} from '@/types/preferences';
import {
  migratePreferencesToCanonical,
  isLegacyFormat,
  createPreferenceValue,
  addValueToCategory,
  routePreference,
  MIN_AUTO_ROUTE_CONFIDENCE,
  countTotalPreferences
} from '@/utils/preferenceRouting';
import {
  isLegacyConstraintFormat,
  migrateToUnifiedConstraints,
  createUnifiedConstraint,
  addUnifiedConstraint as addConstraintToList,
  removeUnifiedConstraint as removeConstraintFromList,
} from '@/utils/constraintUtils';
import type { ConstraintTargetType, ConstraintScope } from '@/types/preferences';

interface PreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  hasPreferences: boolean;
  learnedPreferences: LearnedPreference[];
  updatePreferences: (preferences: UserPreferences) => Promise<boolean>;
  resetPreferences: () => Promise<boolean>;
  shouldShowOnboarding: boolean;
  setShouldShowOnboarding: (show: boolean) => void;
  // Unified constraint management (new)
  unifiedConstraints: UnifiedConstraintsType;
  updateUnifiedConstraints: (constraints: UnifiedConstraintsType) => Promise<boolean>;
  addUnifiedConstraint: (constraint: UnifiedConstraint) => Promise<boolean>;
  removeUnifiedConstraint: (id: string) => Promise<boolean>;
  // Legacy constraint management (deprecated, for backward compat)
  updateConstraints: (constraints: ConstraintsType | UnifiedConstraintsType) => Promise<boolean>;
  addCustomConstraint: (constraint: Omit<CustomConstraint, 'id' | 'createdAt'>) => Promise<boolean>;
  removeCustomConstraint: (id: string) => Promise<boolean>;
  // Preference value management (new canonical API)
  addPreferenceValue: (field: CanonicalCategory | string, value: PreferenceValue) => Promise<boolean>;
  removePreferenceValue: (field: CanonicalCategory | string, normalizedValue: string) => Promise<boolean>;
  // Learned preferences management
  fetchLearnedPreferences: () => Promise<void>;
  approveLearnedPreference: (scope: string, key: string, value: any, confidence?: number, evidence?: string, learnedPref?: LearnedPreference) => Promise<boolean>;
  dismissLearnedPreference: (scope: string, key: string) => Promise<boolean>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [unifiedConstraints, setUnifiedConstraints] = useState<UnifiedConstraintsType>({ items: [], budget: 'no_preference' });
  const [learnedPreferences, setLearnedPreferences] = useState<LearnedPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const { toast } = useToast();

  // Get auth context safely with error handling
  let user = null;
  let authIsLoading = true;
  
  try {
    const auth = useAuth();
    user = auth.user;
    authIsLoading = auth.isLoading;
  } catch (error) {
    console.warn('⚠️ [PreferencesProvider] Auth context not ready yet, will retry...', error);
  }

  // Calculate if the user has any meaningful preferences set
  const hasPreferences = countTotalPreferences(preferences) > 0;

  // Track when auth is ready
  useEffect(() => {
    if (!authIsLoading) {
      setAuthReady(true);
    }
  }, [authIsLoading]);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!authReady || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        console.log('📋 [PreferencesProvider] Fetching preferences for user:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('❌ [PreferencesProvider] Error fetching preferences:', error);
          return;
        }

        let userPrefs = (data?.preferences as any) || {};
        
        // Migrate legacy format to canonical if needed
        if (isLegacyFormat(userPrefs)) {
          console.log('🔄 [PreferencesProvider] Migrating legacy preferences to canonical format');
          userPrefs = migratePreferencesToCanonical(userPrefs);
          // Save migrated preferences back
          await updateUserPreferences(user.id, userPrefs);
        }
        
        setPreferences(userPrefs);
        
        // Load constraints - handle both legacy and unified formats
        if (userPrefs.constraints) {
          if (isLegacyConstraintFormat(userPrefs.constraints)) {
            // Legacy format - migrate it
            console.log('🔄 [PreferencesProvider] Migrating legacy constraints to unified format');
            const migratedConstraints = migrateToUnifiedConstraints(userPrefs.constraints);
            setUnifiedConstraints(migratedConstraints);
          } else if ('items' in userPrefs.constraints) {
            // Already unified format stored in constraints key
            setUnifiedConstraints(userPrefs.constraints as UnifiedConstraintsType);
          }
        } else if (userPrefs.unifiedConstraints) {
          setUnifiedConstraints(userPrefs.unifiedConstraints);
        }
        
        if (countTotalPreferences(userPrefs) === 0) {
          setShouldShowOnboarding(true);
        }
        // Also fetch learned preferences
        await fetchLearnedPreferencesInternal(user.id, userPrefs);
      } catch (err) {
        console.error('❌ [PreferencesProvider] Error in fetchPreferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [authReady, user?.id]);

  // Helper: Get all normalized preference values across all categories
  const getAllNormalizedPreferenceValues = (prefs: UserPreferences): Set<string> => {
    const values = new Set<string>();
    
    // Check all canonical categories
    const categories = ['skin_type', 'hair_type', 'food_preferences', 'lifestyle', 'genre_preferences', 'goals'];
    for (const key of categories) {
      const category = prefs[key as keyof UserPreferences] as PreferenceCategory | undefined;
      category?.values?.forEach(v => {
        if (v.normalizedValue) values.add(v.normalizedValue.toLowerCase());
      });
    }
    
    // Check custom categories
    if (prefs.custom_categories) {
      Object.values(prefs.custom_categories).forEach(category => {
        category?.values?.forEach(v => {
          if (v.normalizedValue) values.add(v.normalizedValue.toLowerCase());
        });
      });
    }
    
    return values;
  };

  const fetchLearnedPreferencesInternal = async (userId: string, currentPrefs?: UserPreferences) => {
    try {
      const { data, error } = await supabase
        .from('user_conversation_memory')
        .select('metadata')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ [PreferencesProvider] Error fetching learned preferences:', error);
        return;
      }

      if (data?.metadata) {
        const metadata = data.metadata as any;
        const scopes = metadata.scopes || {};
        const detectedConstraints = metadata.detected_constraints || [];
        const detectedPreferences = metadata.detected_preferences || [];
        
        // Get all existing normalized values upfront for filtering
        const existingValues = currentPrefs ? getAllNormalizedPreferenceValues(currentPrefs) : new Set<string>();
        
        // Convert scopes to LearnedPreference format
        const learned: LearnedPreference[] = [];
        
        Object.entries(scopes).forEach(([scope, scopeData]: [string, any]) => {
          if (scopeData && typeof scopeData === 'object') {
            Object.entries(scopeData).forEach(([key, value]) => {
              const valuesToCheck = Array.isArray(value) ? value : [value];
              
              for (const singleValue of valuesToCheck) {
                const normalizedValue = String(singleValue).toLowerCase().trim();
                
                // Skip if already exists in preferences
                if (existingValues.has(normalizedValue)) {
                  console.log(`⏭️ Skipping already-saved preference: ${scope}.${key} = ${singleValue}`);
                  continue;
                }
                
                learned.push({
                  scope,
                  key,
                  value: singleValue,
                  confidence: 0.7,
                  extractedAt: new Date().toISOString(),
                });
              }
            });
          }
        });
        
        // Add detected constraints as learned (read approvedAt and dismissed from DB)
        // Use unique ID based on rule + value to ensure each constraint is uniquely identifiable
        detectedConstraints.forEach((c: any) => {
          const uniqueId = `${c.rule}:${c.value}`.toLowerCase().replace(/\s+/g, '_');
          learned.push({
            id: uniqueId,
            scope: c.category,
            key: `constraint:${uniqueId}`,  // Unique key includes the value
            value: c.value,
            confidence: c.confidence || 0.7,
            evidence: c.evidence,
            extractedAt: c.extractedAt || new Date().toISOString(),
            approvedAt: c.approvedAt,
            dismissed: c.dismissed,
            // Preserve constraint metadata for approval routing
            constraintRule: c.rule,
            constraintIntent: c.intent || 'avoid',
          });
        });
        
        // Add detected preferences as learned (read approvedAt and dismissed from DB)
        detectedPreferences.forEach((p: any) => {
          learned.push({
            scope: p.category,
            key: p.key,
            value: p.value,
            confidence: p.confidence || 0.7,
            evidence: p.evidence,
            extractedAt: p.extractedAt || new Date().toISOString(),
            approvedAt: p.approvedAt,
            dismissed: p.dismissed,
          });
        });
        
        // Explicitly filter out already-processed items (defensive)
        const activeLearned = learned.filter(p => !p.approvedAt && !p.dismissed);
        setLearnedPreferences(activeLearned);
      }
    } catch (err) {
      console.error('❌ [PreferencesProvider] Error fetching learned preferences:', err);
    }
  };

  const fetchLearnedPreferences = async () => {
    if (!user) return;
    await fetchLearnedPreferencesInternal(user.id, preferences);
  };

  const updatePreferences = async (newPreferences: UserPreferences) => {
    if (!user) return false;

    try {
      await updateUserPreferences(user.id, newPreferences);
      setPreferences(newPreferences);
      toast({
        title: "Preferences updated",
        description: "Your personalization preferences have been saved."
      });
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: "Error updating preferences",
        description: "There was a problem saving your preferences. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };
  
  const resetPreferences = async () => {
    if (!user) return false;
    
    try {
      await updateUserPreferences(user.id, {});
      setPreferences({});
      setShouldShowOnboarding(true);
      return true;
    } catch (error) {
      console.error('Error resetting preferences:', error);
      return false;
    }
  };


  // Unified Constraint Management (new)
  const updateUnifiedConstraints = async (constraints: UnifiedConstraintsType) => {
    const newPrefs = { ...preferences, unifiedConstraints: constraints };
    setUnifiedConstraints(constraints);
    return updatePreferences(newPrefs);
  };

  const addUnifiedConstraint = async (constraint: UnifiedConstraint) => {
    const updated = addConstraintToList(unifiedConstraints, constraint);
    return updateUnifiedConstraints(updated);
  };

  const removeUnifiedConstraint = async (id: string) => {
    const updated = removeConstraintFromList(unifiedConstraints, id);
    return updateUnifiedConstraints(updated);
  };

  // Legacy constraint management (for backward compat - routes to unified)
  const updateConstraints = async (constraints: ConstraintsType | UnifiedConstraintsType) => {
    // Check if it's already unified format
    if ('items' in constraints) {
      return updateUnifiedConstraints(constraints as UnifiedConstraintsType);
    }
    // Migrate legacy to unified
    const unified = migrateToUnifiedConstraints(constraints as ConstraintsType);
    return updateUnifiedConstraints(unified);
  };

  const addCustomConstraint = async (constraint: Omit<CustomConstraint, 'id' | 'createdAt'>) => {
    // Convert to unified constraint
    const unified = createUnifiedConstraint('rule', constraint.value, {
      scope: 'global',
      intent: constraint.intent === 'strictly_avoid' ? 'strictly_avoid' : 'avoid',
      source: constraint.source,
    });
    return addUnifiedConstraint(unified);
  };

  const removeCustomConstraint = async (id: string) => {
    return removeUnifiedConstraint(id);
  };

  // New canonical preference value management
  const addPreferenceValue = async (field: CanonicalCategory | string, value: PreferenceValue) => {
    const canonicalFields: CanonicalCategory[] = ['skin_type', 'hair_type', 'food_preferences', 'lifestyle', 'genre_preferences', 'goals'];
    
    if (canonicalFields.includes(field as CanonicalCategory)) {
      // Add to canonical field
      const currentCategory = preferences[field as CanonicalCategory] as PreferenceCategory | undefined;
      const updatedCategory = addValueToCategory(currentCategory, value);
      const newPrefs = { ...preferences, [field]: updatedCategory };
      return updatePreferences(newPrefs);
    } else {
      // Add to custom_categories
      const customCategories = preferences.custom_categories || {};
      const currentCategory = customCategories[field];
      const updatedCategory = addValueToCategory(currentCategory, value);
      const newPrefs = {
        ...preferences,
        custom_categories: {
          ...customCategories,
          [field]: updatedCategory
        }
      };
      return updatePreferences(newPrefs);
    }
  };

  const removePreferenceValue = async (field: CanonicalCategory | string, normalizedValue: string) => {
    const canonicalFields: CanonicalCategory[] = ['skin_type', 'hair_type', 'food_preferences', 'lifestyle', 'genre_preferences', 'goals'];
    
    if (canonicalFields.includes(field as CanonicalCategory)) {
      const currentCategory = preferences[field as CanonicalCategory] as PreferenceCategory | undefined;
      if (!currentCategory?.values) return true;
      
      const updatedValues = currentCategory.values.filter(v => v.normalizedValue !== normalizedValue);
      const newPrefs = { 
        ...preferences, 
        [field]: updatedValues.length > 0 ? { values: updatedValues } : undefined 
      };
      return updatePreferences(newPrefs);
    } else {
      const customCategories = preferences.custom_categories || {};
      const currentCategory = customCategories[field];
      if (!currentCategory?.values) return true;
      
      const updatedValues = currentCategory.values.filter(v => v.normalizedValue !== normalizedValue);
      const newCustomCategories = { ...customCategories };
      
      if (updatedValues.length > 0) {
        newCustomCategories[field] = { values: updatedValues };
      } else {
        delete newCustomCategories[field];
      }
      
      const newPrefs = {
        ...preferences,
        custom_categories: Object.keys(newCustomCategories).length > 0 ? newCustomCategories : undefined
      };
      return updatePreferences(newPrefs);
    }
  };

  // Helper: Map detected rule to constraint target type
  const ruleToTargetType = (rule?: string): ConstraintTargetType => {
    if (!rule) return 'rule';
    const r = rule.toLowerCase();
    if (r.includes('ingredient')) return 'ingredient';
    if (r.includes('brand')) return 'brand';
    if (r.includes('genre')) return 'genre';
    if (r.includes('food') || r.includes('cuisine')) return 'food_type';
    if (r.includes('format') || r.includes('form')) return 'format';
    return 'rule';
  };

  // Helper: Map scope string to ConstraintScope
  const scopeToConstraintScope = (scopeStr: string): ConstraintScope => {
    const s = scopeStr.toLowerCase();
    if (['skincare', 'haircare', 'beauty'].includes(s)) return 'skincare';
    if (['food', 'dietary', 'nutrition'].includes(s)) return 'food';
    if (['movies', 'books', 'music', 'entertainment'].includes(s)) return 'entertainment';
    return 'global';
  };

  // Smart approval with routing
  const approveLearnedPreference = async (
    scope: string, 
    key: string, 
    value: any,
    confidence: number = 0.7,
    evidence?: string,
    learnedPref?: LearnedPreference
  ) => {
    if (!user) return false;
    
    // Guard against double-approval
    const existingPref = learnedPreferences.find(p => p.scope === scope && p.key === key);
    if (existingPref?.approvedAt || existingPref?.dismissed) {
      return true; // Already processed, no-op
    }
    
    // Use passed object or find from state
    const fullPref = learnedPref || existingPref;
    
    // Check if this is a constraint
    const isConstraint = key.startsWith('constraint:');
    
    let success = false;
    
    if (isConstraint) {
      // Check if we have constraint metadata (new format)
      const hasConstraintMetadata = fullPref?.constraintRule || fullPref?.constraintIntent;
      
      if (hasConstraintMetadata) {
        // Use preserved metadata - no re-fetching needed
        const targetType = ruleToTargetType(fullPref!.constraintRule);
        const constraintScope = scopeToConstraintScope(scope);
        const intent = fullPref!.constraintIntent === 'strictly_avoid' ? 'strictly_avoid' : 'avoid';
        
        const unified = createUnifiedConstraint(
          targetType,
          typeof value === 'object' ? JSON.stringify(value) : String(value),
          {
            scope: constraintScope,
            intent,
            source: 'chatbot',
          }
        );
        success = await addUnifiedConstraint(unified);
      } else {
        // Backward compatibility: older items without metadata
        const unified = createUnifiedConstraint('rule', String(value), {
          scope: 'global',
          intent: 'avoid',
          source: 'chatbot',
        });
        success = await addUnifiedConstraint(unified);
      }
    } else {
      // Check confidence threshold
      if (confidence < MIN_AUTO_ROUTE_CONFIDENCE) {
        console.log(`⚠️ Low confidence (${confidence}) for preference, keeping in review`);
        // Still mark as processed but don't add to preferences
        // Could show a different UI for low-confidence items
      }
      
      // Route to canonical field or custom_categories
      const targetField = routePreference(scope);
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      const newValue = createPreferenceValue(
        valueStr,
        'chatbot',
        'like',
        confidence,
        evidence
      );
      
      if (targetField) {
        success = await addPreferenceValue(targetField, newValue);
      } else {
        // Route to custom_categories
        success = await addPreferenceValue(scope, newValue);
      }
    }
    
    if (success) {
      // Mark as approved in user_conversation_memory
      try {
        const { data: memoryData } = await supabase
          .from('user_conversation_memory')
          .select('metadata')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (memoryData?.metadata) {
          const metadata = memoryData.metadata as any;
          const updatedConstraints = (metadata.detected_constraints || []).map((c: any) => {
            const constraintId = `${c.rule}:${c.value}`.toLowerCase().replace(/\s+/g, '_');
            const expectedKey = `constraint:${constraintId}`;
            if (c.category === scope && expectedKey === key) {
              return { ...c, approvedAt: new Date().toISOString() };
            }
            return c;
          });
          const updatedPreferences = (metadata.detected_preferences || []).map((p: any) => {
            if (p.category === scope && p.key === key) {
              return { ...p, approvedAt: new Date().toISOString() };
            }
            return p;
          });
          
          await supabase
            .from('user_conversation_memory')
            .update({
              metadata: {
                ...metadata,
                detected_constraints: updatedConstraints,
                detected_preferences: updatedPreferences,
              }
            })
            .eq('user_id', user.id);
        }
      } catch (err) {
        console.error('Error updating memory metadata:', err);
      }
      
      // Update local state - remove from list since it's now approved
      setLearnedPreferences(prev => prev.filter(p => !(p.scope === scope && p.key === key)));
    }
    return success;
  };

  const dismissLearnedPreference = async (scope: string, key: string) => {
    if (!user) return false;
    
    // Guard against double-dismissal
    const existingPref = learnedPreferences.find(p => p.scope === scope && p.key === key);
    if (existingPref?.approvedAt || existingPref?.dismissed) {
      return true; // Already processed, no-op
    }
    
    try {
      const { data: memoryData } = await supabase
        .from('user_conversation_memory')
        .select('metadata')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (memoryData?.metadata) {
        const metadata = memoryData.metadata as any;
        const updatedConstraints = (metadata.detected_constraints || []).map((c: any) => {
          const constraintId = `${c.rule}:${c.value}`.toLowerCase().replace(/\s+/g, '_');
          const expectedKey = `constraint:${constraintId}`;
          if (c.category === scope && expectedKey === key) {
            return { ...c, dismissed: true, dismissedAt: new Date().toISOString() };
          }
          return c;
        });
        const updatedPreferences = (metadata.detected_preferences || []).map((p: any) => {
          if (p.category === scope && p.key === key) {
            return { ...p, dismissed: true, dismissedAt: new Date().toISOString() };
          }
          return p;
        });
        
        await supabase
          .from('user_conversation_memory')
          .update({
            metadata: {
              ...metadata,
              detected_constraints: updatedConstraints,
              detected_preferences: updatedPreferences,
            }
          })
          .eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error updating memory metadata:', err);
    }
    
    // Update local state - remove from list since it's now dismissed
    setLearnedPreferences(prev => prev.filter(p => !(p.scope === scope && p.key === key)));
    return true;
  };

  const value = {
    preferences,
    isLoading,
    hasPreferences,
    learnedPreferences,
    updatePreferences,
    resetPreferences,
    shouldShowOnboarding,
    setShouldShowOnboarding,
    // Unified constraints (new)
    unifiedConstraints,
    updateUnifiedConstraints,
    addUnifiedConstraint,
    removeUnifiedConstraint,
    // Legacy (backward compat)
    updateConstraints,
    addCustomConstraint,
    removeCustomConstraint,
    addPreferenceValue,
    removePreferenceValue,
    fetchLearnedPreferences,
    approveLearnedPreference,
    dismissLearnedPreference,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = React.useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
