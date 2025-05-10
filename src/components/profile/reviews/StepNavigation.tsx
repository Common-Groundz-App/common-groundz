
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  onPrevious: () => void;
  onNext: () => void;
  isNextDisabled: boolean;
  isSubmitting: boolean;
}

const StepNavigation = ({ 
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  onPrevious,
  onNext,
  isNextDisabled,
  isSubmitting
}: StepNavigationProps) => {
  return (
    <div className="grid grid-cols-3 items-center pt-8 border-t mt-8">
      <div className="justify-self-start">
        {!isFirstStep ? (
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
            disabled={isSubmitting}
            className="border-brand-orange/30 hover:bg-brand-orange/5 hover:text-brand-orange transition-all duration-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        ) : (
          <div /> // Empty div to maintain layout
        )}
      </div>
      
      <p className="text-sm text-muted-foreground justify-self-center">
        Step {currentStep} of {totalSteps}
      </p>
      
      <div className="justify-self-end">
        <Button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isSubmitting}
          className="bg-gradient-to-r from-brand-orange to-brand-orange/90 hover:from-brand-orange/90 hover:to-brand-orange text-white shadow-md hover:shadow-lg transition-all duration-300"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isLastStep ? "Submitting..." : "Processing..."}
            </>
          ) : (
            <>
              {isLastStep ? "Submit Review" : "Next"}
              {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default StepNavigation;
