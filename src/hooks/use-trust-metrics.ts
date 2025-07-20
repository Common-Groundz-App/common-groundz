
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TrustMetrics {
  circleReviewsPercentage: number;
  averageTrustScore: number;
  timelineActivityPercentage: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  ratingEvolution: {
    periods: string[];
    ratings: number[];
  };
  lastUpdated: string;
  totalReviews: number;
}

export const useTrustMetrics = (entityId: string | null, userId: string | null) => {
  const [metrics, setMetrics] = useState<TrustMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) {
      setMetrics(null);
      return;
    }

    const fetchTrustMetrics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get all reviews for this entity
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('id, user_id, rating, latest_rating, trust_score, has_timeline, created_at, updated_at')
          .eq('entity_id', entityId)
          .eq('status', 'published');

        if (reviewsError) throw reviewsError;

        if (!reviews || reviews.length === 0) {
          setMetrics({
            circleReviewsPercentage: 0,
            averageTrustScore: 0,
            timelineActivityPercentage: 0,
            ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            ratingEvolution: { periods: [], ratings: [] },
            lastUpdated: 'No reviews yet',
            totalReviews: 0
          });
          return;
        }

        // Calculate circle reviews percentage (only if user is logged in)
        let circleReviewsPercentage = 0;
        if (userId) {
          const { data: followingData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId);

          if (followingData) {
            const followingIds = followingData.map(f => f.following_id);
            const circleReviews = reviews.filter(r => followingIds.includes(r.user_id));
            circleReviewsPercentage = reviews.length > 0 ? (circleReviews.length / reviews.length) * 100 : 0;
          }
        }

        // Calculate average trust score (convert 1.0-2.0 range to 50-100%)
        const avgTrustScore = reviews.reduce((sum, review) => sum + (review.trust_score || 1.0), 0) / reviews.length;
        const averageTrustScore = ((avgTrustScore - 1.0) / 1.0) * 100; // Convert to percentage

        // Calculate timeline activity percentage
        const timelineReviews = reviews.filter(r => r.has_timeline);
        const timelineActivityPercentage = (timelineReviews.length / reviews.length) * 100;

        // Calculate rating breakdown using effective rating (latest_rating or rating)
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(review => {
          const effectiveRating = review.latest_rating || review.rating;
          const roundedRating = Math.round(effectiveRating) as 1 | 2 | 3 | 4 | 5;
          ratingCounts[roundedRating]++;
        });

        const ratingBreakdown = {
          5: Math.round((ratingCounts[5] / reviews.length) * 100),
          4: Math.round((ratingCounts[4] / reviews.length) * 100),
          3: Math.round((ratingCounts[3] / reviews.length) * 100),
          2: Math.round((ratingCounts[2] / reviews.length) * 100),
          1: Math.round((ratingCounts[1] / reviews.length) * 100)
        };

        // Calculate rating evolution over time periods
        const now = new Date();
        const periods = ['90 days ago', '60 days ago', '30 days ago', 'Now'];
        const ratings: number[] = [];

        for (let i = 3; i >= 0; i--) {
          const cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - (i * 30));
          
          const reviewsUpToDate = reviews.filter(r => new Date(r.created_at) <= cutoffDate);
          
          if (reviewsUpToDate.length > 0) {
            const avgRating = reviewsUpToDate.reduce((sum, review) => {
              const effectiveRating = review.latest_rating || review.rating;
              return sum + effectiveRating;
            }, 0) / reviewsUpToDate.length;
            ratings.push(Number(avgRating.toFixed(1)));
          } else {
            ratings.push(0);
          }
        }

        // Get last updated timestamp
        const lastUpdatedTimestamp = Math.max(
          ...reviews.map(r => new Date(r.updated_at).getTime())
        );
        const lastUpdated = new Date(lastUpdatedTimestamp);
        const timeDiff = now.getTime() - lastUpdated.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        let lastUpdatedString;
        if (daysDiff === 0) {
          lastUpdatedString = 'Today';
        } else if (daysDiff === 1) {
          lastUpdatedString = '1 day ago';
        } else if (daysDiff < 7) {
          lastUpdatedString = `${daysDiff} days ago`;
        } else if (daysDiff < 30) {
          const weeksDiff = Math.floor(daysDiff / 7);
          lastUpdatedString = weeksDiff === 1 ? '1 week ago' : `${weeksDiff} weeks ago`;
        } else {
          const monthsDiff = Math.floor(daysDiff / 30);
          lastUpdatedString = monthsDiff === 1 ? '1 month ago' : `${monthsDiff} months ago`;
        }

        setMetrics({
          circleReviewsPercentage: Math.round(circleReviewsPercentage),
          averageTrustScore: Math.round(averageTrustScore),
          timelineActivityPercentage: Math.round(timelineActivityPercentage),
          ratingBreakdown,
          ratingEvolution: { periods, ratings },
          lastUpdated: lastUpdatedString,
          totalReviews: reviews.length
        });

      } catch (err) {
        console.error('Error fetching trust metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch trust metrics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrustMetrics();
  }, [entityId, userId]);

  return { metrics, isLoading, error };
};
