
import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { supabase } from '@/integrations/supabase/client';

interface DynamicRatingDisplayProps {
  reviewId: string;
  initialRating: number;
  hasTimeline: boolean;
  timelineCount?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const DynamicRatingDisplay = ({ 
  reviewId, 
  initialRating, 
  hasTimeline, 
  timelineCount,
  size = 'sm',
  className = '' 
}: DynamicRatingDisplayProps) => {
  const [latestRating, setLatestRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasTimeline || !timelineCount || timelineCount === 0) {
      return;
    }

    const fetchLatestRating = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('review_updates')
          .select('rating')
          .eq('review_id', reviewId)
          .not('rating', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching latest rating:', error);
          return;
        }

        if (data && data.rating !== null) {
          setLatestRating(data.rating);
        }
      } catch (err) {
        console.error('Exception fetching latest rating:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestRating();
  }, [reviewId, hasTimeline, timelineCount]);

  // Get rating color based on value
  const getRatingColor = (rating: number): string => {
    if (rating < 2) return "#ea384c"; // red
    if (rating < 3) return "#F97316"; // orange
    if (rating < 4) return "#FEC006"; // yellow
    if (rating < 4.5) return "#84cc16"; // lime
    return "#22c55e"; // green
  };

  // If not a dynamic review or no latest rating, show single rating
  if (!hasTimeline || !timelineCount || timelineCount === 0 || latestRating === null || isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <ConnectedRingsRating
          value={initialRating}
          variant="badge"
          showValue={false}
          size={size === 'xs' ? 'badge' : size}
          minimal={true}
        />
        <span 
          className="font-bold"
          style={{ color: getRatingColor(initialRating) }}
        >
          {initialRating.toFixed(1)}
        </span>
      </div>
    );
  }

  // Show rating evolution for dynamic reviews
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Initial Rating */}
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={initialRating}
          variant="badge"
          showValue={false}
          size={size === 'xs' ? 'badge' : size}
          minimal={true}
        />
        <span 
          className="text-sm font-bold"
          style={{ color: getRatingColor(initialRating) }}
        >
          {initialRating.toFixed(1)}
        </span>
      </div>

      {/* Arrow */}
      <ArrowRight className="h-3 w-3 text-muted-foreground" />

      {/* Latest Rating */}
      <div className="flex items-center gap-1">
        <ConnectedRingsRating
          value={latestRating}
          variant="badge"
          showValue={false}
          size={size === 'xs' ? 'badge' : size}
          minimal={true}
        />
        <span 
          className="text-sm font-bold"
          style={{ color: getRatingColor(latestRating) }}
        >
          {latestRating.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
