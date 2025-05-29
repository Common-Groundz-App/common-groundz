
import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactRatingDisplayProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

export const CompactRatingDisplay: React.FC<CompactRatingDisplayProps> = ({
  rating,
  size = 'md',
  showValue = true,
  className
}) => {
  const getRatingColor = (rating: number) => {
    if (rating < 2) return "#ea384c";
    if (rating < 3) return "#F97316";
    if (rating < 4) return "#FEC006";
    if (rating < 4.5) return "#84cc16";
    return "#22c55e";
  };

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Star 
        className={sizeClasses[size]}
        style={{ color: getRatingColor(rating) }}
        fill="currentColor"
      />
      {showValue && (
        <span 
          className={cn("font-bold", textSizeClasses[size])}
          style={{ color: getRatingColor(rating) }}
        >
          {rating}
        </span>
      )}
    </div>
  );
};
