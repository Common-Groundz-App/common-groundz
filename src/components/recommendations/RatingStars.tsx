
import React from 'react';
import { cn } from "@/lib/utils";
import ConnectedRingsRating from './ConnectedRingsRating';

interface RatingStarsProps {
  rating: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'badge';
  variant?: 'default' | 'badge';
  showValue?: boolean;
  className?: string;
}

const RatingStars = ({ 
  rating, 
  size = 'sm',
  variant = 'default',
  showValue = false,
  className
}: RatingStarsProps) => {
  return (
    <ConnectedRingsRating
      value={rating}
      size={size}
      showValue={showValue}
      className={className}
      minimal={true}
      variant={variant}
    />
  );
};

export default RatingStars;
