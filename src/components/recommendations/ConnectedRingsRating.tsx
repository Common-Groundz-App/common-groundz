
import React from 'react';
import { cn } from '@/lib/utils';

interface ConnectedRingsRatingProps {
  rating?: number;
  value?: number; // Support both naming conventions
  maxRating?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg'; // Add 'xs' size
  onChange?: (rating: number) => void;
  className?: string;
  isInteractive?: boolean;
  showValue?: boolean;
  showLabel?: boolean;
}

const ConnectedRingsRating: React.FC<ConnectedRingsRatingProps> = ({
  rating: propRating,
  value: propValue, // Accept both rating and value props
  maxRating = 5,
  size = 'md',
  onChange,
  className,
  isInteractive = false,
  showValue = false,
  showLabel = false
}) => {
  // Use either rating or value, preferring rating if both are provided
  const rating = propRating !== undefined ? propRating : (propValue !== undefined ? propValue : 0);
  
  const rings = Array.from({ length: maxRating }, (_, i) => i + 1);
  
  const getSizeClass = () => {
    switch (size) {
      case 'xs': return 'h-3 w-3';
      case 'sm': return 'h-4 w-4';
      case 'lg': return 'h-6 w-6';
      case 'md':
      default: return 'h-5 w-5';
    }
  };
  
  const getSpacingClass = () => {
    switch (size) {
      case 'xs': return '-ml-0.5';
      case 'sm': return '-ml-1';
      case 'lg': return '-ml-2';
      case 'md':
      default: return '-ml-1.5';
    }
  };

  const getLabelText = (rating: number): string => {
    if (rating === 0) return "Not rated";
    if (rating === 1) return "Poor";
    if (rating === 2) return "Fair";
    if (rating === 3) return "Good";
    if (rating === 4) return "Great";
    if (rating === 5) return "Excellent";
    return "";
  };
  
  return (
    <div className="flex flex-col items-center">
      <div className={cn("flex items-center", className)}>
        {rings.map((r) => (
          <div
            key={r}
            className={cn(
              "rounded-full border-2 flex items-center justify-center cursor-default",
              r <= rating ? "border-brand-orange text-brand-orange" : "border-gray-200 text-gray-200",
              isInteractive && "cursor-pointer hover:scale-110 transition-transform",
              getSizeClass(),
              r > 1 ? getSpacingClass() : ""
            )}
            onClick={() => isInteractive && onChange && onChange(r)}
            role={isInteractive ? "button" : undefined}
            tabIndex={isInteractive ? 0 : undefined}
          >
            {r <= rating && (
              <span className="block rounded-full bg-brand-orange"
                style={{
                  width: '60%',
                  height: '60%'
                }}
              />
            )}
          </div>
        ))}
        
        {showValue && (
          <span className="ml-2 text-brand-orange font-semibold">
            {rating.toFixed(1)}
          </span>
        )}
      </div>
      
      {showLabel && rating > 0 && (
        <span className="text-xs text-muted-foreground mt-1">
          {getLabelText(rating)}
        </span>
      )}
    </div>
  );
};

export default ConnectedRingsRating;
