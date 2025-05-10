
import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

const StepIndicator = ({ currentStep, totalSteps, completedSteps, onStepClick }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center space-x-2 mb-6 w-full max-w-md mx-auto">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const stepNumber = index + 1;
        const isActive = currentStep === stepNumber;
        const isCompleted = completedSteps.includes(stepNumber);
        const isClickable = isCompleted && onStepClick;
        
        const stepIndicator = (
          <div
            key={`step-${stepNumber}`}
            className="flex items-center"
          >
            {/* Step indicator */}
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                isActive && "ring-2 ring-brand-orange",
                isCompleted 
                  ? "bg-brand-orange text-white" 
                  : isActive 
                    ? "bg-accent/50 text-foreground border border-brand-orange" 
                    : "bg-accent text-muted-foreground",
                isClickable && "hover:scale-110 hover:brightness-110 cursor-pointer"
              )}
              onClick={() => isClickable && onStepClick?.(stepNumber)}
              aria-label={isClickable ? `Go to step ${stepNumber}` : undefined}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="text-sm">{stepNumber}</span>
              )}
            </div>
            
            {/* Connecting line */}
            {index < totalSteps - 1 && (
              <div 
                className={cn(
                  "h-0.5 w-10", 
                  (isCompleted && completedSteps.includes(stepNumber + 1)) 
                    ? "bg-brand-orange" 
                    : "bg-accent"
                )}
              />
            )}
          </div>
        );

        // Wrap non-current, non-completed steps with tooltip explaining they're not accessible
        if (!isCompleted && !isActive) {
          return (
            <TooltipProvider key={`step-${stepNumber}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {stepIndicator}
                </TooltipTrigger>
                <TooltipContent>
                  <p>Complete previous steps first</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        
        return stepIndicator;
      })}
    </div>
  );
};

export default StepIndicator;
