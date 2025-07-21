
import React from 'react';
import { getSentimentColor } from '@/utils/ratingColorUtils';

interface RatingRingIconProps {
  rating: number;
  size?: number;
  className?: string;
}

export const RatingRingIcon: React.FC<RatingRingIconProps> = ({ 
  rating, 
  size = 16, 
  className = '' 
}) => {
  const color = getSentimentColor(rating, true);
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke={color}
        strokeWidth="3"
        fill="none"
      />
    </svg>
  );
};
