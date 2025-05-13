
import React from 'react';
import { cn } from "@/lib/utils";
import ConnectedRingsRating from './ConnectedRingsRating';

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

const RatingStars = ({ 
  rating, 
  size = 'sm',
  showValue = false,
  className
}: RatingStarsProps) => {
  return (
    <ConnectedRingsRating
      value={rating}
      size={size}
      showValue={showValue}
      className={className}
      isInteractive={false}
    />
  );
};

export default RatingStars;
