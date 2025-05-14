
import React from 'react';
import { cn } from "@/lib/utils";
import ConnectedRingsRating from '@/components/recommendations/ConnectedRingsRating';

interface RatingStarsEnhancedProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

// This component is kept for backwards compatibility but uses ConnectedRingsRating internally
const RatingStarsEnhanced = ({ value, onChange, size = 'md' }: RatingStarsEnhancedProps) => {
  return (
    <div className="flex flex-col items-center py-6 px-4 rounded-xl bg-accent/10 w-full">
      <p className="text-center mb-4 text-lg font-medium">How would you rate it?</p>
      <div className="flex justify-center items-center w-full">
        <ConnectedRingsRating
          value={value}
          onChange={onChange}
          size={size}
          showValue={true}
          isInteractive={true}
          showLabel={true}
          variant="standard"
          className="transition-all duration-300 hover:scale-105"
        />
      </div>
    </div>
  );
};

export default RatingStarsEnhanced;
