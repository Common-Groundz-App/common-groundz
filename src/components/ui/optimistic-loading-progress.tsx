
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from '@/lib/utils';

interface OptimisticLoadingProgressProps {
  steps: string[];
  currentStep: number;
  entityName?: string;
  className?: string;
}

export const OptimisticLoadingProgress: React.FC<OptimisticLoadingProgressProps> = ({
  steps,
  currentStep,
  entityName,
  className
}) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    if (currentStep < steps.length) {
      setDisplayText(steps[currentStep]);
    }
  }, [currentStep, steps]);

  const progress = Math.min((currentStep / Math.max(steps.length - 1, 1)) * 100, 100);

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardContent className="p-6 space-y-6">
        {/* Animated Logo/Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
          </div>
        </div>

        {/* Entity Name */}
        {entityName && (
          <div className="text-center">
            <h3 className="font-semibold text-lg">Loading {entityName}</h3>
          </div>
        )}

        {/* Progress Steps */}
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground animate-fade-in">
              {displayText}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {Math.min(currentStep + 1, steps.length)}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Animated Dots */}
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
