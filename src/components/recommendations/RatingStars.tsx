
import React from 'react';
import { cn } from "@/lib/utils";
import ConnectedRingsRating from './ConnectedRingsRating';

interface RatingStarsProps {
  rating: number;
  size?: 'xs' | 'sm' | 'md' | 'lg'; // Update to include 'xs'
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
      rating={rating}
      size={size}
      showValue={showValue}
      className={className}
      isInteractive={false}
    />
  );
};

export default RatingStars;
