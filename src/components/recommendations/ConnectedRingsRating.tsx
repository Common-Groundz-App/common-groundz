
import React from 'react';
import { cn } from "@/lib/utils";
import { CircleUserRound } from 'lucide-react';

interface ConnectedRingsRatingProps {
  value: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showValue?: boolean;
  isInteractive?: boolean;
  showLabel?: boolean;
  className?: string;
  onChange?: (value: number) => void;
}

const ConnectedRingsRating = ({
  value = 0,
  size = 'sm',
  showValue = true,
  isInteractive = true,
  showLabel = true,
  className,
  onChange
}: ConnectedRingsRatingProps) => {
  // Size configurations
  const sizeConfig = {
    xs: {
      svgSize: 10,
      spacing: 1,
      strokeWidth: 1,
      fontSize: 'text-xs',
    },
    sm: {
      svgSize: 16,
      spacing: 2,
      strokeWidth: 1.5,
      fontSize: 'text-sm',
    },
    md: {
      svgSize: 20,
      spacing: 3,
      strokeWidth: 1.5,
      fontSize: 'text-base',
    },
    lg: {
      svgSize: 24,
      spacing: 4,
      strokeWidth: 2,
      fontSize: 'text-lg',
    }
  };
  
  const config = sizeConfig[size];
  
  // Convert rating to ring display value
  const displayValue = value < 0 ? 0 : value > 5 ? 5 : value;

  // Calculate normalized rating as percentage (0-100)
  const ratingPercentage = (displayValue / 5) * 100;
  const numCircles = 5;
  
  // Interactive rating handler
  const handleClick = isInteractive 
    ? (index: number) => {
        if (onChange) onChange(index + 1);
      }
    : undefined;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div 
        className={cn("flex flex-row", 
          isInteractive && "cursor-pointer"
        )}
        style={{ gap: `${config.spacing}px` }}
      >
        {Array.from({ length: numCircles }).map((_, index) => {
          const isFilled = index + 1 <= Math.ceil(displayValue);
          const isPartiallyFilled = index + 1 === Math.ceil(displayValue) && displayValue % 1 !== 0;
          const fillPercent = isPartiallyFilled ? ((displayValue % 1) * 100) : (isFilled ? 100 : 0);
          
          return (
            <div 
              key={index}
              onClick={handleClick ? () => handleClick(index) : undefined}
              className="relative"
            >
              <svg 
                width={config.svgSize} 
                height={config.svgSize} 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="relative z-10"
              >
                <circle 
                  cx="12" 
                  cy="12" 
                  r="9"
                  stroke="currentColor"
                  strokeWidth={config.strokeWidth}
                  className="text-gray-200 dark:text-gray-700"
                />
                {fillPercent > 0 && (
                  <circle 
                    cx="12" 
                    cy="12" 
                    r="9" 
                    stroke="currentColor"
                    strokeWidth={config.strokeWidth + 0.5}
                    strokeDasharray={`${2 * Math.PI * 9 * (fillPercent / 100)} ${2 * Math.PI * 9}`}
                    strokeDashoffset={2 * Math.PI * 9 * 0.25}
                    className="text-brand-orange dark:text-brand-orange"
                    transform="rotate(-90 12 12)"
                  />
                )}
              </svg>
              
              {/* Connect adjacent rings with lines */}
              {index < numCircles - 1 && (
                <div 
                  className={cn(
                    "absolute top-1/2 -right-[1px] h-[1px] -translate-y-1/2 bg-gray-200 dark:bg-gray-700",
                    fillPercent === 100 && "bg-brand-orange dark:bg-brand-orange"
                  )}
                  style={{ 
                    width: `${config.spacing}px`, 
                    right: `-${config.spacing}px`,
                    zIndex: 5
                  }}
                ></div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Show numerical value */}
      {showValue && (
        <span className={cn("font-medium", config.fontSize)}>
          {displayValue.toFixed(1)}
        </span>
      )}
      
      {/* Optional label */}
      {showLabel && (
        <span className={cn("text-muted-foreground", config.fontSize)}>
          / 5.0
        </span>
      )}
    </div>
  );
};

export default ConnectedRingsRating;
