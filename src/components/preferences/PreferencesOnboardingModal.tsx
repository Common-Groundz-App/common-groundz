
import React, { useEffect } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PreferencesForm from './PreferencesForm';
import { useAuth } from '@/contexts/AuthContext';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';

const PreferencesOnboardingModal = () => {
  const [openModal, setOpenModal] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = React.useState(false);

  // Get auth context safely
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    console.warn('⚠️ [PreferencesOnboardingModal] Auth context not ready, skipping modal');
    return null;
  }

  // Get preferences context safely
  let shouldShowOnboarding = false;
  let hasPreferences = false;
  let setShouldShowOnboarding = () => {};

  try {
    const preferences = usePreferences();
    shouldShowOnboarding = preferences.shouldShowOnboarding;
    hasPreferences = preferences.hasPreferences;
    setShouldShowOnboarding = preferences.setShouldShowOnboarding;
  } catch (error) {
    console.warn('⚠️ [PreferencesOnboardingModal] Preferences context not ready, skipping modal');
    return null;
  }

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
    setShowExitConfirmation(false);
  };

  const handleSaveSuccess = () => {
    setOpenModal(false);
    setShouldShowOnboarding(false);
  };

  // Handler for when the user tries to close the modal
  const handleCloseAttempt = () => {
    if (showForm) {
      // If form is showing, we want to confirm before closing
      setShowExitConfirmation(true);
    } else {
      // If form is not showing, we can just close
      handleClose();
    }
  };

  // Handler for the ESC key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (openModal && event.key === 'Escape') {
        // Prevent the default ESC behavior to handle it ourselves
        event.preventDefault();
        handleCloseAttempt();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [openModal, showForm]);

  return (
    <>
      <Dialog 
        open={openModal} 
        onOpenChange={(open) => {
          if (!open) {
            // User is trying to close the dialog (clicked X or outside)
            handleCloseAttempt();
          } else {
            setOpenModal(open);
          }
        }}
      >
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
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">Personalize Your Experience</DialogTitle>
                <DialogDescription className="sr-only">
                  Set your preferences to get personalized recommendations
                </DialogDescription>
              </DialogHeader>
              <PreferencesForm 
                onSaveSuccess={handleSaveSuccess} 
                onCancel={handleClose}
                isModal 
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog when trying to exit with unsaved changes */}
      <DeleteConfirmationDialog
        isOpen={showExitConfirmation}
        onClose={() => setShowExitConfirmation(false)}
        onConfirm={handleClose}
        title="Exit Without Saving?"
        description="Your preferences haven't been saved. Are you sure you want to exit?"
      />
    </>
  );
};

export default PreferencesOnboardingModal;
