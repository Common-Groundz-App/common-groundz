
import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useThemedClass } from '@/utils/theme-utils';

interface RatingStarsEnhancedProps {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const RatingStarsEnhanced = ({ value, onChange, size = 'md' }: RatingStarsEnhancedProps) => {
  const [hoverRating, setHoverRating] = useState(0);
  const bgClass = useThemedClass('bg-gradient-to-r from-amber-50 to-orange-50', 'bg-gradient-to-r from-orange-950/30 to-amber-950/30');
  
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-9 w-9"
  };

  const getRatingText = (rating: number) => {
    if (rating === 0) return "Tap to rate";
    if (rating === 5) return "Loved it! 😍";
    if (rating === 4) return "Really good 👍";
    if (rating === 3) return "It's okay 😊";
    if (rating === 2) return "Not great 😐";
    return "Didn't like it 😕";
  };

  return (
    <div className="flex flex-col items-center py-6 px-4 rounded-xl bg-accent/10">
      <p className="text-center mb-4 text-lg font-medium">How would you rate it?</p>
      <div 
        className={cn(
          "flex items-center justify-center p-4 rounded-full mb-3",
          bgClass,
          "transition-all duration-300 hover:scale-105"
        )}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            className="p-1 hover:transform hover:scale-110 transition-transform duration-100"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={cn(
                sizeClasses[size],
                "transition-all duration-200",
                (star <= (hoverRating || value)) 
                  ? "fill-brand-orange text-brand-orange scale-110" 
                  : "text-gray-300 dark:text-gray-600"
              )}
            />
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-center">
        {getRatingText(hoverRating || value)}
      </span>
    </div>
  );
};

export default RatingStarsEnhanced;
