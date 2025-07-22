
import { useState, useEffect } from 'react';
import { fetchReviewUpdates, type ReviewUpdate } from '@/services/reviewService';
import { ReviewWithUser } from '@/types/entities';

export interface TimelineReviewData {
  review: ReviewWithUser;
  updates: ReviewUpdate[];
  isLoading: boolean;
}

export const useTimelineReviews = (timelineReviews: ReviewWithUser[]) => {
  const [timelineData, setTimelineData] = useState<Map<string, TimelineReviewData>>(new Map());

  useEffect(() => {
    const fetchTimelineData = async () => {
      if (timelineReviews.length === 0) {
        setTimelineData(new Map());
        return;
      }

      console.log('🔄 Fetching timeline data for reviews:', timelineReviews.map(r => r.id));

      // Create initial map with loading states
      const initialMap = new Map<string, TimelineReviewData>();
      timelineReviews.forEach(review => {
        initialMap.set(review.id, {
          review,
          updates: [],
          isLoading: true
        });
      });
      setTimelineData(initialMap);

      // Fetch timeline updates for each review
      const fetchPromises = timelineReviews.map(async (review) => {
        try {
          const updates = await fetchReviewUpdates(review.id);
          return { reviewId: review.id, updates };
        } catch (error) {
          console.error(`Error fetching timeline for review ${review.id}:`, error);
          return { reviewId: review.id, updates: [] };
        }
      });

      const results = await Promise.all(fetchPromises);
      
      // Update map with fetched data
      const updatedMap = new Map(initialMap);
      results.forEach(({ reviewId, updates }) => {
        const existing = updatedMap.get(reviewId);
        if (existing) {
          updatedMap.set(reviewId, {
            ...existing,
            updates,
            isLoading: false
          });
        }
      });

      setTimelineData(updatedMap);
    };

    fetchTimelineData();
  }, [timelineReviews]);

  return timelineData;
};
