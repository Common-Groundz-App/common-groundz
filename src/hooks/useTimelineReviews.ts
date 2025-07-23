
import { useState, useEffect } from 'react';
import { ReviewWithUser } from '@/types/entities';
import { fetchReviewUpdates } from '@/services/review/timeline';
import { ReviewUpdate } from '@/services/review/types';

interface TimelineReviewData {
  review: ReviewWithUser;
  updates: ReviewUpdate[];
  isLoading: boolean;
}

export const useTimelineReviews = (reviews: ReviewWithUser[]) => {
  const [timelineData, setTimelineData] = useState<Map<string, TimelineReviewData>>(new Map());

  useEffect(() => {
    const loadTimelineData = async () => {
      const timelineReviews = reviews.filter(
        review => review.has_timeline && review.timeline_count && review.timeline_count > 0
      );

      if (timelineReviews.length === 0) return;

      // Initialize loading states
      const newTimelineData = new Map<string, TimelineReviewData>();
      timelineReviews.forEach(review => {
        newTimelineData.set(review.id, {
          review,
          updates: [],
          isLoading: true
        });
      });
      setTimelineData(newTimelineData);

      // Fetch timeline updates for each review
      for (const review of timelineReviews) {
        try {
          const updates = await fetchReviewUpdates(review.id);
          setTimelineData(prev => new Map(prev).set(review.id, {
            review,
            updates,
            isLoading: false
          }));
        } catch (error) {
          console.error(`Error loading timeline for review ${review.id}:`, error);
          setTimelineData(prev => new Map(prev).set(review.id, {
            review,
            updates: [],
            isLoading: false
          }));
        }
      }
    };

    loadTimelineData();
  }, [reviews]);

  return timelineData;
};
