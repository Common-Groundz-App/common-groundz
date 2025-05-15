
import React from 'react';
import { cn } from '@/lib/utils';
import ConnectedRingsRating from '@/components/recommendations/ConnectedRingsRating';

interface StepOneProps {
  rating: number;
  onChange: (rating: number) => void;
}

const StepOne = ({ rating, onChange }: StepOneProps) => {
  return (
    <div className="flex flex-col items-center py-10 px-4 space-y-6 w-full">
      <h2 className="text-xl font-medium text-center">
        How would you rate your experience?
      </h2>
      
      <div className="flex justify-center items-center w-full">
        <ConnectedRingsRating
          rating={rating}
          onChange={onChange}
          size="lg"
          showValue={true}
          isInteractive={true}
          showLabel={true}
          className="transition-all duration-300 hover:scale-105"
        />
      </div>
      
      <p className="text-center text-muted-foreground">
        {rating === 0 
          ? "Tap on the rings to rate your experience" 
          : rating < 3 
            ? "We're sorry to hear that. Your feedback helps improve!"
            : rating < 4 
              ? "Thanks for your honest rating!"
              : "Awesome! We're glad you had a great experience!"}
      </p>
    </div>
  );
};

export default StepOne;
