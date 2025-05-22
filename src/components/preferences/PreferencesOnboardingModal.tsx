
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePreferences } from '@/contexts/PreferencesContext';
import PreferencesForm from './PreferencesForm';

const PreferencesOnboardingModal: React.FC = () => {
  const { showOnboarding, setShowOnboarding, markOnboardingComplete } = usePreferences();

  const handleSkip = () => {
    markOnboardingComplete();
  };

  const handleComplete = () => {
    markOnboardingComplete();
  };

  return (
    <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Get Personalized Recommendations</DialogTitle>
          <DialogDescription>
            Answer a few quick questions so we can match you with the right products, places, and content. 
            You can skip and edit this anytime later.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <PreferencesForm onComplete={handleComplete} onSkip={handleSkip} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesOnboardingModal;
