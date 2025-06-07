
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Star, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { ProfileDisplay } from '@/components/common/ProfileDisplay';
import { formatRelativeDate } from '@/utils/dateUtils';

interface TimelineEntry {
  id: string;
  review_id: string;
  user_id: string;
  rating?: number;
  comment: string;
  created_at: string;
  updated_at: string;
  user?: {
    username?: string;
    avatar_url?: string;
  };
}

interface TimelineViewerProps {
  reviewId: string;
  timelineCount: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const TimelineViewer = ({ 
  reviewId, 
  timelineCount, 
  isExpanded = false, 
  onToggle 
}: TimelineViewerProps) => {
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && timelineEntries.length === 0) {
      // TODO: Fetch timeline entries from the review service
      // This will be implemented when we have the timeline fetching function
      setIsLoading(true);
      // Placeholder for now
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  }, [isExpanded, reviewId, timelineEntries.length]);

  if (timelineCount === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <Clock className="h-4 w-4" />
        <span>Timeline ({timelineCount} updates)</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
              <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
            </div>
          ) : timelineEntries.length > 0 ? (
            timelineEntries.map((entry, index) => (
              <Card key={entry.id} className="relative">
                {index < timelineEntries.length - 1 && (
                  <div className="absolute left-6 top-16 bottom-0 w-px bg-border"></div>
                )}
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 relative z-10"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <ProfileDisplay 
                          userId={entry.user_id}
                          size="sm"
                          showUsername={true}
                        />
                        {entry.rating && (
                          <Badge variant="outline" className="gap-1">
                            <Star className="h-3 w-3" />
                            {entry.rating}/5
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeDate(entry.created_at)}
                        </span>
                      </div>
                      <p className="text-sm">{entry.comment}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Timeline updates will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
