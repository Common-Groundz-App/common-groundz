
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp } from 'lucide-react';

interface TimelineIndicatorProps {
  hasTimeline: boolean;
  timelineCount: number;
  trustScore?: number;
  isRecommended?: boolean;
  size?: 'sm' | 'md';
}

export const TimelineIndicator = ({ 
  hasTimeline, 
  timelineCount, 
  trustScore, 
  isRecommended,
  size = 'md' 
}: TimelineIndicatorProps) => {
  if (!hasTimeline && !isRecommended) return null;

  const badgeSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-2">
      {isRecommended && (
        <Badge 
          variant="outline" 
          className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
        >
          <TrendingUp className="h-3 w-3 mr-1" />
          <span className={badgeSize}>Recommended</span>
        </Badge>
      )}
      
      {hasTimeline && timelineCount > 0 && (
        <Badge 
          variant="outline" 
          className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
        >
          <Clock className="h-3 w-3 mr-1" />
          <span className={badgeSize}>
            {timelineCount} update{timelineCount !== 1 ? 's' : ''}
          </span>
        </Badge>
      )}
      
      {trustScore && trustScore > 1.0 && (
        <Badge 
          variant="outline" 
          className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
        >
          <span className={badgeSize}>Trust {trustScore.toFixed(1)}</span>
        </Badge>
      )}
    </div>
  );
};
