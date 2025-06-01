import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { updateUserPreferences } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';

interface PreferencesContextType {
  preferences: any;
  isLoading: boolean;
  hasPreferences: boolean;
  updatePreferences: (preferences: any) => Promise<boolean>;
  resetPreferences: () => Promise<boolean>;
  shouldShowOnboarding: boolean;
  setShouldShowOnboarding: (show: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<any>({});
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
    // Auth context not ready yet, keep defaults
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
      // Only proceed if auth is ready and we have a user
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

        const userPrefs = data?.preferences || {};
        setPreferences(userPrefs);
        
        // Check if we should show the onboarding modal
        if (Object.keys(userPrefs).length === 0) {
          setShouldShowOnboarding(true);
        }
      } catch (err) {
        console.error('❌ [PreferencesProvider] Error in fetchPreferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [authReady, user?.id]); // Only depend on authReady and user.id

  const updatePreferences = async (newPreferences: any) => {
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

  const value = {
    preferences,
    isLoading,
    hasPreferences,
    updatePreferences,
    resetPreferences,
    shouldShowOnboarding,
    setShouldShowOnboarding
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
