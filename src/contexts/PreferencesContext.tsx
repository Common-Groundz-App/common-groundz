import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { updateUserPreferences } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';
import { 
  UserPreferences, 
  ConstraintsType, 
  CustomConstraint, 
  CustomPreference,
  LearnedPreference 
} from '@/types/preferences';

interface PreferencesContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  hasPreferences: boolean;
  learnedPreferences: LearnedPreference[];
  updatePreferences: (preferences: UserPreferences) => Promise<boolean>;
  resetPreferences: () => Promise<boolean>;
  shouldShowOnboarding: boolean;
  setShouldShowOnboarding: (show: boolean) => void;
  // Constraint management
  updateConstraints: (constraints: ConstraintsType) => Promise<boolean>;
  addCustomConstraint: (constraint: Omit<CustomConstraint, 'id' | 'createdAt'>) => Promise<boolean>;
  removeCustomConstraint: (id: string) => Promise<boolean>;
  // Custom preference management
  addCustomPreference: (pref: Omit<CustomPreference, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  removeCustomPreference: (id: string) => Promise<boolean>;
  // Learned preferences management
  fetchLearnedPreferences: () => Promise<void>;
  approveLearnedPreference: (scope: string, key: string, value: any) => Promise<boolean>;
  dismissLearnedPreference: (scope: string, key: string) => Promise<boolean>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({});
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
  const hasPreferences = Object.keys(preferences || {}).length > 0;

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

        const userPrefs = (data?.preferences as UserPreferences) || {};
        setPreferences(userPrefs);
        
        if (Object.keys(userPrefs).length === 0) {
          setShouldShowOnboarding(true);
        }
        
        // Also fetch learned preferences
        await fetchLearnedPreferencesInternal(user.id);
      } catch (err) {
        console.error('❌ [PreferencesProvider] Error in fetchPreferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [authReady, user?.id]);

  const fetchLearnedPreferencesInternal = async (userId: string) => {
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
        
        // Convert scopes to LearnedPreference format
        const learned: LearnedPreference[] = [];
        
        Object.entries(scopes).forEach(([scope, scopeData]: [string, any]) => {
          if (scopeData && typeof scopeData === 'object') {
            Object.entries(scopeData).forEach(([key, value]) => {
              learned.push({
                scope,
                key,
                value,
                confidence: 0.7, // Default confidence for existing data
                extractedAt: new Date().toISOString(),
              });
            });
          }
        });
        
        // Add detected constraints as learned
        detectedConstraints.forEach((c: any) => {
          learned.push({
            scope: c.category,
            key: `constraint: ${c.rule}`,
            value: c.value,
            confidence: c.confidence || 0.7,
            evidence: c.evidence,
            extractedAt: new Date().toISOString(),
          });
        });
        
        // Add detected preferences as learned
        detectedPreferences.forEach((p: any) => {
          learned.push({
            scope: p.category,
            key: p.key,
            value: p.value,
            confidence: p.confidence || 0.7,
            evidence: p.evidence,
            extractedAt: new Date().toISOString(),
          });
        });
        
        setLearnedPreferences(learned);
      }
    } catch (err) {
      console.error('❌ [PreferencesProvider] Error fetching learned preferences:', err);
    }
  };

  const fetchLearnedPreferences = async () => {
    if (!user) return;
    await fetchLearnedPreferencesInternal(user.id);
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

  // Constraint management
  const updateConstraints = async (constraints: ConstraintsType) => {
    const newPrefs = { ...preferences, constraints };
    return updatePreferences(newPrefs);
  };

  const addCustomConstraint = async (constraint: Omit<CustomConstraint, 'id' | 'createdAt'>) => {
    const newConstraint: CustomConstraint = {
      ...constraint,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    const currentConstraints = preferences.constraints || {};
    const newConstraints = {
      ...currentConstraints,
      custom: [...(currentConstraints.custom || []), newConstraint]
    };
    return updateConstraints(newConstraints);
  };

  const removeCustomConstraint = async (id: string) => {
    const currentConstraints = preferences.constraints || {};
    const newConstraints = {
      ...currentConstraints,
      custom: (currentConstraints.custom || []).filter(c => c.id !== id)
    };
    return updateConstraints(newConstraints);
  };

  // Custom preference management
  const addCustomPreference = async (pref: Omit<CustomPreference, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newPref: CustomPreference = {
      ...pref,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const currentCustom = preferences.custom_preferences || [];
    const newPrefs = { ...preferences, custom_preferences: [...currentCustom, newPref] };
    return updatePreferences(newPrefs);
  };

  const removeCustomPreference = async (id: string) => {
    const currentCustom = preferences.custom_preferences || [];
    const newPrefs = { ...preferences, custom_preferences: currentCustom.filter(p => p.id !== id) };
    return updatePreferences(newPrefs);
  };

  // Learned preferences management
  const approveLearnedPreference = async (scope: string, key: string, value: any) => {
    // Add to custom preferences with user priority
    const success = await addCustomPreference({
      category: scope,
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      source: 'chatbot',
      confidence: 1.0,
      priority: 'user',
    });
    
    if (success) {
      // Mark as approved in local state
      setLearnedPreferences(prev => 
        prev.map(p => 
          p.scope === scope && p.key === key 
            ? { ...p, approvedAt: new Date().toISOString() }
            : p
        )
      );
    }
    return success;
  };

  const dismissLearnedPreference = async (scope: string, key: string) => {
    // Mark as dismissed in local state
    setLearnedPreferences(prev => 
      prev.map(p => 
        p.scope === scope && p.key === key 
          ? { ...p, dismissed: true }
          : p
      )
    );
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
    updateConstraints,
    addCustomConstraint,
    removeCustomConstraint,
    addCustomPreference,
    removeCustomPreference,
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
