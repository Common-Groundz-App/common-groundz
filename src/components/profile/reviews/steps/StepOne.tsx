
import React from 'react';
import { cn } from '@/lib/utils';
import ConnectedRingsRating from '@/components/recommendations/ConnectedRingsRating';
import { AlertCircle } from 'lucide-react';

interface StepOneProps {
  rating: number;
  onChange: (rating: number) => void;
  showError?: boolean;
}

const StepOne = ({ rating, onChange, showError = false }: StepOneProps) => {
  return (
    <div className="flex flex-col items-center py-10 px-4 space-y-6 w-full">
      <h2 className="text-xl font-medium text-center">
        How would you rate your experience?
      </h2>
      
      <div className="flex justify-center items-center w-full">
        <ConnectedRingsRating
          value={rating}
          onChange={onChange}
          size="lg"
          showValue={true}
          isInteractive={true}
          showLabel={true}
          className={cn(
            "transition-all duration-300 hover:scale-105",
            showError && rating === 0 ? "animate-shake" : ""
          )}
        />
      </div>
      
      {showError && rating === 0 ? (
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p>Please select a rating to continue</p>
        </div>
      ) : (
        <p className="text-center text-muted-foreground">
          {rating === 0 
            ? "Tap on the rings to rate your experience" 
            : rating < 3 
              ? "We're sorry to hear that. Your feedback helps improve!"
              : rating < 4 
                ? "Thanks for your honest rating!"
                : "Awesome! We're glad you had a great experience!"}
        </p>
      )}
    </div>
  );
};

export default StepOne;
