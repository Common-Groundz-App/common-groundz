
import React from 'react';
import { Star } from 'lucide-react';
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

const RatingStars = ({ 
  rating, 
  size = 'sm',
  showValue = true,
  className
}: RatingStarsProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };
  
  return (
    <div className={cn("flex items-center", className)}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star 
          key={star} 
          size={16} 
          className={cn(
            "mr-1", 
            sizeClasses[size],
            star <= Math.floor(rating) 
              ? "fill-brand-orange text-brand-orange" 
              : star === Math.ceil(rating) && star > Math.floor(rating) 
                ? "fill-brand-orange/50 text-brand-orange/50" 
                : "text-gray-300 dark:text-gray-600"
          )} 
        />
      ))}
      {showValue && (
        <span className={cn(
          "ml-2 font-bold", 
          size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
        )}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default RatingStars;
