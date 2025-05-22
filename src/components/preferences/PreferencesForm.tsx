
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/contexts/PreferencesContext';
import StepIndicator from './PreferenceStepIndicator';
import SkinTypeStep from './steps/SkinTypeStep';
import HairTypeStep from './steps/HairTypeStep';
import FoodPreferencesStep from './steps/FoodPreferencesStep';
import GoalsStep from './steps/GoalsStep';
import LifestyleStep from './steps/LifestyleStep';
import GenrePreferencesStep from './steps/GenrePreferencesStep';

interface PreferencesFormProps {
  onComplete: () => void;
  onSkip: () => void;
}

const PreferencesForm: React.FC<PreferencesFormProps> = ({ onComplete, onSkip }) => {
  const { updatePreferences } = usePreferences();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { name: 'Skin', component: SkinTypeStep },
    { name: 'Hair', component: HairTypeStep },
    { name: 'Food', component: FoodPreferencesStep },
    { name: 'Goals', component: GoalsStep },
    { name: 'Lifestyle', component: LifestyleStep },
    { name: 'Genres', component: GenrePreferencesStep },
  ];

  const totalSteps = steps.length;
  const CurrentStepComponent = steps[currentStep].component;

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepDataChange = (data: Record<string, any>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updatePreferences(formData);
      onComplete();
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} totalSteps={totalSteps} stepNames={steps.map(s => s.name)} />
      
      <div className="py-4 min-h-[250px]">
        <CurrentStepComponent 
          onChange={handleStepDataChange}
          initialData={formData}
        />
      </div>
      
      <div className="flex justify-between pt-4 border-t">
        <div>
          {currentStep === 0 ? (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : (
            <Button variant="outline" onClick={handlePrevious} disabled={isSubmitting}>
              Back
            </Button>
          )}
        </div>
        
        <div>
          {!isLastStep ? (
            <Button onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Preferences'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreferencesForm;
