
import React from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface ConnectedRingsRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  isInteractive?: boolean;
  showLabel?: boolean;
  className?: string;
}

const ConnectedRingsRating = ({
  value = 0,
  onChange,
  size = 'md',
  showValue = false,
  isInteractive = false,
  showLabel = false,
  className
}: ConnectedRingsRatingProps) => {
  // Size mapping for different ring dimensions
  const sizeMap = {
    sm: {
      outerRing: 'w-16 h-16',
      innerRing: 'w-12 h-12',
      ringThickness: 'border-[3px]',
      fontSize: 'text-xs',
      scoreSize: 'text-lg',
      labelSize: 'text-[10px]'
    },
    md: {
      outerRing: 'w-20 h-20',
      innerRing: 'w-16 h-16',
      ringThickness: 'border-[4px]',
      fontSize: 'text-sm',
      scoreSize: 'text-2xl',
      labelSize: 'text-xs'
    },
    lg: {
      outerRing: 'w-24 h-24',
      innerRing: 'w-20 h-20',
      ringThickness: 'border-[5px]',
      fontSize: 'text-base',
      scoreSize: 'text-3xl',
      labelSize: 'text-sm'
    }
  };
  
  // Get appropriate size classes
  const { outerRing, innerRing, ringThickness, fontSize, scoreSize, labelSize } = sizeMap[size];
  
  // Calculate color based on rating
  const getRingColor = (rating: number) => {
    if (rating >= 4.5) return 'border-green-500';
    if (rating >= 3.5) return 'border-brand-orange';
    if (rating >= 2.5) return 'border-yellow-500';
    if (rating >= 1.5) return 'border-orange-500';
    return 'border-red-500';
  };
  
  // Calculate the value to display
  const displayValue = value.toFixed(1);
  
  // Handle click if interactive
  const handleClick = (newValue: number) => {
    if (isInteractive && onChange) {
      onChange(newValue);
    }
  };
  
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div 
        className={cn(
          "relative flex items-center justify-center rounded-full border-4 border-dashed",
          outerRing,
          getRingColor(value)
        )}
      >
        <div 
          className={cn(
            "absolute inset-0 rounded-full border-4 animate-[spin_12s_linear_infinite]",
            getRingColor(value)
          )}
          style={{opacity: 0.3}}
        />
        <div 
          className={cn(
            "flex items-center justify-center rounded-full border-solid bg-background",
            innerRing,
            ringThickness,
            getRingColor(value)
          )}
        >
          <span className={cn("font-bold", scoreSize)}>
            {displayValue}
          </span>
        </div>
      </div>
      
      {showLabel && (
        <div className={cn("mt-1 text-center", labelSize)}>
          <span className="font-medium text-muted-foreground">
            Groundz Score
          </span>
          {showValue && (
            <div className="flex items-center justify-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "w-3 h-3 cursor-pointer",
                    star <= value
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-gray-300"
                  )}
                  onClick={() => isInteractive && handleClick(star)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectedRingsRating;
