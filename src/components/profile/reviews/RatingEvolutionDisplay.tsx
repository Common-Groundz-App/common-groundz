
import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { getSentimentColor } from '@/utils/ratingColorUtils';

interface RatingEvolutionDisplayProps {
  initialRating: number;
  latestRating: number;
  size?: 'badge' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'badge';
}

export const RatingEvolutionDisplay = ({ 
  initialRating, 
  latestRating, 
  size = 'badge', 
  variant = 'badge' 
}: RatingEvolutionDisplayProps) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Initial Rating */}
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={initialRating}
          size={size}
          variant={variant}
          showValue={false}
          isInteractive={false}
          showLabel={false}
          minimal={true}
        />
        <span 
          className="text-sm font-bold"
          style={{ color: getSentimentColor(initialRating) }}
        >
          {initialRating.toFixed(1)}
        </span>
      </div>
      
      {/* Arrow */}
      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      
      {/* Latest Rating */}
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={latestRating}
          size={size}
          variant={variant}
          showValue={false}
          isInteractive={false}
          showLabel={false}
          minimal={true}
        />
        <span 
          className="text-sm font-bold"
          style={{ color: getSentimentColor(latestRating) }}
        >
          {latestRating.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
