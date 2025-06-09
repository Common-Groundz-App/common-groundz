
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TimelineData {
  averageInitialRating: number;
  averageLatestRating: number;
  averageUpdateDays: number;
  totalTimelineUpdates: number;
  // AI summary fields (preserved for future use)
  aiSummary?: string;
  aiSummaryLastGenerated?: string;
  aiSummaryModel?: string;
}

export const useEntityTimelineSummary = (entityId: string, dynamicReviewIds: string[]) => {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTimelineData = async () => {
      if (!entityId || !dynamicReviewIds.length) {
        setTimelineData(null);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch timeline updates for dynamic reviews
        const { data: updates, error } = await supabase
          .from('review_updates')
          .select(`
            review_id,
            rating,
            created_at
          `)
          .in('review_id', dynamicReviewIds)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching timeline updates:', error);
          throw error;
        }

        // Fetch the original reviews to get initial ratings and dates + AI summaries
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('id, rating, created_at, ai_summary, ai_summary_last_generated_at, ai_summary_model_used')
          .in('id', dynamicReviewIds);

        if (reviewsError) {
          console.error('Error fetching reviews:', reviewsError);
          throw reviewsError;
        }

        if (!updates || !reviews) {
          console.log('No updates or reviews found');
          setTimelineData(null);
          return;
        }

        // Process the data
        const reviewMap = new Map(reviews.map(r => [r.id, r]));
        const updatesByReview = new Map<string, typeof updates>();
        
        // Group updates by review
        updates.forEach(update => {
          if (!updatesByReview.has(update.review_id)) {
            updatesByReview.set(update.review_id, []);
          }
          updatesByReview.get(update.review_id)!.push(update);
        });

        let totalInitialRating = 0;
        let totalLatestRating = 0;
        let totalUpdateDays = 0;
        let reviewsWithUpdates = 0;
        let totalUpdates = 0;

        // Calculate metrics for each review
        dynamicReviewIds.forEach(reviewId => {
          const review = reviewMap.get(reviewId);
          const reviewUpdates = updatesByReview.get(reviewId) || [];
          
          if (!review) return;

          const initialRating = review.rating;
          const latestRating = reviewUpdates.length > 0 
            ? reviewUpdates[reviewUpdates.length - 1].rating || initialRating
            : initialRating;

          totalInitialRating += initialRating;
          totalLatestRating += latestRating;
          totalUpdates += reviewUpdates.length;

          // Calculate days to first update
          if (reviewUpdates.length > 0) {
            const reviewDate = new Date(review.created_at);
            const firstUpdateDate = new Date(reviewUpdates[0].created_at);
            const daysDiff = Math.abs((firstUpdateDate.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
            totalUpdateDays += daysDiff;
            reviewsWithUpdates++;
          }
        });

        const reviewCount = dynamicReviewIds.length;
        
        // Find the most recent AI summary from reviews (if any exist)
        const reviewsWithSummaries = reviews.filter(r => r.ai_summary);
        const mostRecentSummary = reviewsWithSummaries.length > 0
          ? reviewsWithSummaries.reduce((latest, current) => {
              const latestDate = latest.ai_summary_last_generated_at ? new Date(latest.ai_summary_last_generated_at) : new Date(0);
              const currentDate = current.ai_summary_last_generated_at ? new Date(current.ai_summary_last_generated_at) : new Date(0);
              return currentDate > latestDate ? current : latest;
            })
          : null;
        
        console.log('Timeline data calculated successfully:', {
          reviewCount,
          totalUpdates,
          averageInitialRating: totalInitialRating / reviewCount,
          averageLatestRating: totalLatestRating / reviewCount
        });
        
        setTimelineData({
          averageInitialRating: totalInitialRating / reviewCount,
          averageLatestRating: totalLatestRating / reviewCount,
          averageUpdateDays: reviewsWithUpdates > 0 ? totalUpdateDays / reviewsWithUpdates : 0,
          totalTimelineUpdates: totalUpdates,
          aiSummary: mostRecentSummary?.ai_summary || undefined,
          aiSummaryLastGenerated: mostRecentSummary?.ai_summary_last_generated_at || undefined,
          aiSummaryModel: mostRecentSummary?.ai_summary_model_used || undefined,
        });

      } catch (error) {
        console.error('Error fetching timeline data:', error);
        setTimelineData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimelineData();
  }, [entityId, dynamicReviewIds]);

  return {
    timelineData,
    isLoading
  };
};
