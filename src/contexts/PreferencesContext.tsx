
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile, updateProfilePreferences } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';

type PreferencesContextType = {
  preferences: Record<string, any>;
  isLoading: boolean;
  showOnboarding: boolean;
  hasCompletedOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  updatePreferences: (newPreferences: Record<string, any>) => Promise<boolean>;
  markOnboardingComplete: () => void;
};

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

interface PreferencesProviderProps {
  children: ReactNode;
}

export const PreferencesProvider: React.FC<PreferencesProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Load preferences when user changes
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) {
        setPreferences({});
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const profile = await fetchUserProfile(user.id);
        
        if (profile) {
          setPreferences(profile.preferences || {});
          
          // Show onboarding if preferences is empty and user hasn't completed onboarding
          if (Object.keys(profile.preferences || {}).length === 0 && !hasCompletedOnboarding) {
            setShowOnboarding(true);
          }
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your preferences',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user, toast, hasCompletedOnboarding]);

  const updatePreferences = async (newPreferences: Record<string, any>) => {
    if (!user) return false;

    try {
      const updatedPreferences = { ...preferences, ...newPreferences };
      await updateProfilePreferences(user.id, updatedPreferences);
      setPreferences(updatedPreferences);
      
      toast({
        title: 'Success',
        description: 'Your preferences have been saved',
      });
      
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your preferences',
        variant: 'destructive'
      });
      return false;
    }
  };

  const markOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const value = {
    preferences,
    isLoading,
    showOnboarding,
    hasCompletedOnboarding,
    setShowOnboarding,
    updatePreferences,
    markOnboardingComplete,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};
