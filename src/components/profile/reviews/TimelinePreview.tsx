
import React from 'react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ChevronRight } from 'lucide-react';
import { getSentimentColor } from '@/utils/ratingColorUtils';

interface TimelinePreviewProps {
  initialRating: number;
  latestRating: number;
  updateCount: number;
  compact?: boolean;
}

export const TimelinePreview = ({ 
  initialRating, 
  latestRating, 
  updateCount, 
  compact = false 
}: TimelinePreviewProps) => {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={initialRating}
          variant="badge"
          showValue={false}
          size={compact ? "sm" : "md"}
          minimal={true}
        />
        <span 
          className="font-medium text-muted-foreground"
          style={{ color: getSentimentColor(initialRating) }}
        >
          {initialRating.toFixed(1)}
        </span>
      </div>
      
      <ChevronRight className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground`} />
      
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={latestRating}
          variant="badge"
          showValue={false}
          size={compact ? "sm" : "md"}
          minimal={true}
        />
        <span 
          className="font-medium"
          style={{ color: getSentimentColor(latestRating) }}
        >
          {latestRating.toFixed(1)}
        </span>
      </div>
      
      <span className="text-muted-foreground">
        ({updateCount} update{updateCount !== 1 ? 's' : ''})
      </span>
    </div>
  );
};
