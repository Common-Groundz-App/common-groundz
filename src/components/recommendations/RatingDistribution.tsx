
import React from 'react';
import { CircleContributor } from '@/hooks/use-circle-rating-types';

interface RatingDistributionProps {
  contributors: CircleContributor[];
  size?: 'sm' | 'md';
  className?: string;
}

export const RatingDistribution: React.FC<RatingDistributionProps> = ({
  contributors,
  size = 'sm',
  className = ''
}) => {
  // Count ratings by star level
  const ratingCounts = {
    5: contributors.filter(c => c.rating >= 4.5).length,
    4: contributors.filter(c => c.rating >= 3.5 && c.rating < 4.5).length,
    3: contributors.filter(c => c.rating >= 2.5 && c.rating < 3.5).length,
    2: contributors.filter(c => c.rating >= 1.5 && c.rating < 2.5).length,
    1: contributors.filter(c => c.rating < 1.5).length,
  };

  const totalRatings = contributors.length;
  
  if (totalRatings === 0) return null;

  const getRatingColor = (rating: number) => {
    if (rating === 5) return "#22c55e";
    if (rating === 4) return "#84cc16";
    if (rating === 3) return "#FEC006";
    if (rating === 2) return "#F97316";
    return "#ea384c";
  };

  const barHeight = size === 'sm' ? 'h-1' : 'h-1.5';
  const containerHeight = size === 'sm' ? 'h-1' : 'h-1.5';

  return (
    <div className={`flex items-center gap-0.5 ${containerHeight} ${className}`}>
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = ratingCounts[rating as keyof typeof ratingCounts];
        const percentage = (count / totalRatings) * 100;
        
        return (
          <div
            key={rating}
            className={`${barHeight} rounded-full transition-all duration-200`}
            style={{
              backgroundColor: count > 0 ? getRatingColor(rating) : '#e5e7eb',
              width: `${Math.max(percentage, count > 0 ? 8 : 4)}%`,
              opacity: count > 0 ? 1 : 0.3
            }}
            title={`${count} ${rating}-star rating${count !== 1 ? 's' : ''}`}
          />
        );
      })}
    </div>
  );
};
