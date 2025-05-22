
import React, { useEffect } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PreferencesForm from './PreferencesForm';
import { useAuth } from '@/contexts/AuthContext';

const PreferencesOnboardingModal = () => {
  const { user } = useAuth();
  const { shouldShowOnboarding, setShouldShowOnboarding, hasPreferences } = usePreferences();
  const [openModal, setOpenModal] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);

  useEffect(() => {
    // Only show when logged in, preferences are empty, and onboarding flag is true
    if (user && !hasPreferences && shouldShowOnboarding) {
      setOpenModal(true);
    } else {
      setOpenModal(false);
      setShowForm(false);
    }
  }, [user, hasPreferences, shouldShowOnboarding]);

  const handleStartClick = () => {
    setShowForm(true);
  };

  const handleSkip = () => {
    setOpenModal(false);
    setShouldShowOnboarding(false);
  };

  const handleClose = () => {
    setOpenModal(false);
    setShouldShowOnboarding(false);
  };

  const handleSaveSuccess = () => {
    setOpenModal(false);
    setShouldShowOnboarding(false);
  };

  return (
    <Dialog open={openModal} onOpenChange={setOpenModal}>
      <DialogContent className="sm:max-w-md">
        {!showForm ? (
          <>
            <DialogHeader>
              <div className="text-center mb-2">
                <span className="text-4xl">🪄</span>
              </div>
              <DialogTitle className="text-center text-xl">Get Personalized Recommendations</DialogTitle>
              <DialogDescription className="text-center">
                Answer a few quick questions so we can match you with the right products, places, and content. 
                You can skip and edit this anytime later.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-4">
              <Button 
                onClick={handleStartClick} 
                className="w-full bg-gradient-to-r from-brand-orange to-brand-orange/90 hover:opacity-90 focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Get Started
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSkip} 
                className="w-full focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Skip for now
              </Button>
            </div>
          </>
        ) : (
          <PreferencesForm onSaveSuccess={handleSaveSuccess} onCancel={handleClose} isModal />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PreferencesOnboardingModal;
