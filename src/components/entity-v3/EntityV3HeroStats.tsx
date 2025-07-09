
import React from 'react';
import { Star, TrendingUp, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntityV3HeroStatsProps {
  stats?: {
    recommendationCount: number;
    reviewCount: number;
    averageRating: number | null;
  };
  className?: string;
}

export const EntityV3HeroStats: React.FC<EntityV3HeroStatsProps> = ({
  stats,
  className
}) => {
  const averageRating = stats?.averageRating || 0;
  const hasRating = averageRating > 0;

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star
            key={i}
            className="h-4 w-4 fill-yellow-400 text-yellow-400"
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative h-4 w-4">
            <Star className="h-4 w-4 text-gray-300 absolute" />
            <div className="overflow-hidden w-1/2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            </div>
          </div>
        );
      } else {
        stars.push(
          <Star
            key={i}
            className="h-4 w-4 text-gray-300"
          />
        );
      }
    }

    return stars;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Rating Display */}
      {hasRating && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {renderStars(averageRating)}
          </div>
          <span className="text-2xl font-bold text-foreground">
            {averageRating.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">
            ({formatCount(stats?.reviewCount || 0)} reviews)
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Recommendations
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatCount(stats?.recommendationCount || 0)}
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Reviews
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatCount(stats?.reviewCount || 0)}
          </div>
        </div>
      </div>

      {/* Trust Indicator */}
      {hasRating && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          <span>
            {averageRating >= 4.5 ? 'Excellent' : 
             averageRating >= 4.0 ? 'Very Good' : 
             averageRating >= 3.5 ? 'Good' : 
             averageRating >= 3.0 ? 'Average' : 'Below Average'} rating
          </span>
        </div>
      )}
    </div>
  );
};
