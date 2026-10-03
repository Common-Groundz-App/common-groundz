
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
    // Generation guard: answers from an older run (e.g. for a review that has
    // since been deleted) must never write back into state.
    let cancelled = false;

    const timelineReviews = reviews.filter(
      review => review.has_timeline && review.timeline_count && review.timeline_count > 0
    );

    const initial = new Map<string, TimelineReviewData>();
    timelineReviews.forEach(review => {
      initial.set(review.id, { review, updates: [], isLoading: true });
    });
    setTimelineData(initial);

    (async () => {
      for (const review of timelineReviews) {
        let updates: ReviewUpdate[] = [];
        try {
          updates = await fetchReviewUpdates(review.id);
        } catch (error) {
          console.error(`Error loading timeline for review ${review.id}:`, error);
        }
        if (cancelled) return;
        setTimelineData(prev => {
          if (!prev.has(review.id)) return prev;
          return new Map(prev).set(review.id, { review, updates, isLoading: false });
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reviews]);

  return timelineData;
};
