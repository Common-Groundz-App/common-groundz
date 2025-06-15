
import React from 'react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';

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
    <div className="flex items-center gap-2 flex-wrap">
      {/* Initial Rating */}
      <ConnectedRingsRating
        value={initialRating}
        size={size}
        variant={variant}
        showValue={false}
        isInteractive={false}
        showLabel={false}
        minimal={true}
      />
      
      {/* Arrow */}
      <span className="text-muted-foreground text-sm flex-shrink-0">→</span>
      
      {/* Latest Rating */}
      <ConnectedRingsRating
        value={latestRating}
        size={size}
        variant={variant}
        showValue={false}
        isInteractive={false}
        showLabel={false}
        minimal={true}
      />
    </div>
  );
};
