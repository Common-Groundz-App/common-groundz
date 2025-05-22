
import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepNames?: string[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  currentStep, 
  totalSteps,
  stepNames = []
}) => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center">
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                  ${idx === currentStep 
                    ? 'bg-primary text-primary-foreground' 
                    : idx < currentStep 
                      ? 'bg-primary/70 text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}
              >
                {idx + 1}
              </div>
              {stepNames[idx] && (
                <span className={`text-xs mt-1 ${idx === currentStep ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {stepNames[idx]}
                </span>
              )}
            </div>
            
            {idx < totalSteps - 1 && (
              <div 
                className={`flex-1 h-0.5 mx-2
                  ${idx < currentStep ? 'bg-primary/70' : 'bg-muted'}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;
