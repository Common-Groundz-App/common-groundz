
import React, { useEffect, useState } from 'react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TimelinePreviewProps {
  reviewId?: string;
  initialRating?: number;
  latestRating?: number;
  updateCount?: number;
  compact?: boolean;
}

export const TimelinePreview = ({ 
  reviewId,
  initialRating, 
  latestRating, 
  updateCount, 
  compact = false 
}: TimelinePreviewProps) => {
  const [fetchedInitialRating, setFetchedInitialRating] = useState<number | null>(null);
  const [fetchedLatestRating, setFetchedLatestRating] = useState<number | null>(null);
  const [fetchedUpdateCount, setFetchedUpdateCount] = useState<number | null>(null);

  useEffect(() => {
    if (reviewId && (!initialRating || !latestRating || !updateCount)) {
      const fetchTimelineData = async () => {
        try {
          // Get the review's initial rating
          const { data: reviewData, error: reviewError } = await supabase
            .from('reviews')
            .select('rating')
            .eq('id', reviewId)
            .single();

          if (reviewError) throw reviewError;

          // Get the latest rating from timeline updates
          const { data: updatesData, error: updatesError } = await supabase
            .from('review_updates')
            .select('rating, created_at')
            .eq('review_id', reviewId)
            .not('rating', 'is', null)
            .order('created_at', { ascending: false });

          if (updatesError) throw updatesError;

          if (reviewData) {
            setFetchedInitialRating(reviewData.rating);
          }

          if (updatesData && updatesData.length > 0) {
            setFetchedLatestRating(updatesData[0].rating);
            setFetchedUpdateCount(updatesData.length);
          }
        } catch (error) {
          console.error('Error fetching timeline data:', error);
        }
      };

      fetchTimelineData();
    }
  }, [reviewId, initialRating, latestRating, updateCount]);

  const displayInitialRating = initialRating || fetchedInitialRating;
  const displayLatestRating = latestRating || fetchedLatestRating;
  const displayUpdateCount = updateCount || fetchedUpdateCount;

  if (!displayInitialRating || !displayLatestRating || !displayUpdateCount) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={displayInitialRating}
          variant="badge"
          showValue={false}
          size={compact ? "sm" : "md"}
          minimal={true}
        />
        <span className="font-medium text-muted-foreground">
          {displayInitialRating.toFixed(1)}
        </span>
      </div>
      
      <ChevronRight className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground`} />
      
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={displayLatestRating}
          variant="badge"
          showValue={false}
          size={compact ? "sm" : "md"}
          minimal={true}
        />
        <span className="font-medium">
          {displayLatestRating.toFixed(1)}
        </span>
      </div>
      
      <span className="text-muted-foreground">
        ({displayUpdateCount} update{displayUpdateCount !== 1 ? 's' : ''})
      </span>
    </div>
  );
};
