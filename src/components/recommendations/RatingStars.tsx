
import React from 'react';
import { Star } from 'lucide-react';
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating: number;
}

const RatingStars = ({ rating }: RatingStarsProps) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map(star => (
        <Star 
          key={star} 
          size={16} 
          className={cn(
            "mr-1", 
            star <= Math.floor(rating) 
              ? "fill-brand-orange text-brand-orange" 
              : star === Math.ceil(rating) && star > Math.floor(rating) 
                ? "fill-brand-orange/50 text-brand-orange/50" 
                : "text-gray-300"
          )} 
        />
      ))}
      <span className="ml-2 font-bold text-sm">{rating.toFixed(1)}</span>
    </div>
  );
};

export default RatingStars;
