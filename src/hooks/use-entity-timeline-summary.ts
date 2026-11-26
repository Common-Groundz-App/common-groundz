
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { REVIEWS_CHANGED_EVENT } from '@/services/review/reviewChangeEvents';

interface EntityTimelineSummary {
  averageInitialRating: number;
  averageLatestRating: number;
  averageUpdateDays: number;
  totalTimelineUpdates: number;
  // Entity-level AI summary fields (from entities table)
  entityAiSummary?: string;
  entityAiSummaryLastGenerated?: string;
  entityAiSummaryModel?: string;
}

export const useEntityTimelineSummary = (entityId: string | null) => {
  const [summary, setSummary] = useState<EntityTimelineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // Public <-> Private changes emit the shared review event; refetch then.
  useEffect(() => {
    const bump = () => setRefreshTick(t => t + 1);
    window.addEventListener(REVIEWS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    if (!entityId) {
      setSummary(null);
      return;
    }

    // Each rerun retires the previous request (stale-response guard).
    let cancelled = false;
    const live = () => !cancelled;
    const fetchSummary = async () => {
      live() && setIsLoading(true);
      live() && setError(null);

      try {
        // First get entity-level AI summary data
        const { data: entityData, error: entityError } = await supabase
          .from('entities')
          .select('ai_dynamic_review_summary, ai_dynamic_review_summary_last_generated_at, ai_dynamic_review_summary_model_used')
          .eq('id', entityId)
          .maybeSingle();

        if (entityError) {
          console.error('Error fetching entity AI summary:', entityError);
        }

        // Get all reviews for this entity with timeline updates
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('id, rating, created_at, has_timeline')
          .eq('entity_id', entityId)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .eq('has_timeline', true);

        if (reviewsError) throw reviewsError;

        if (!reviews || reviews.length === 0) {
          live() && setSummary(null);
          return;
        }

        // Get all timeline updates for these reviews
        const reviewIds = reviews.map(r => r.id);
        const { data: updates, error: updatesError } = await supabase
          .from('review_updates')
          .select('review_id, rating, created_at')
          .in('review_id', reviewIds)
          .order('created_at', { ascending: true });

        if (updatesError) throw updatesError;

        // Calculate summary statistics
        const initialRatings = reviews.map(r => r.rating);
        const averageInitialRating = initialRatings.reduce((sum, rating) => sum + rating, 0) / initialRatings.length;

        // Get latest rating for each review (either from updates or original rating)
        const latestRatings = reviews.map(review => {
          const reviewUpdates = updates?.filter(u => u.review_id === review.id && u.rating !== null) || [];
          if (reviewUpdates.length === 0) return review.rating;
          
          // Get the latest update with a rating (sorted by created_at ascending, so take the last one)
          const latestWithRating = reviewUpdates[reviewUpdates.length - 1];
          return latestWithRating?.rating || review.rating;
        });

        const averageLatestRating = latestRatings.reduce((sum, rating) => sum + rating, 0) / latestRatings.length;

        // Calculate average days between review creation and first update
        const updateDelays = reviews.map(review => {
          const firstUpdate = updates?.find(u => u.review_id === review.id);
          if (!firstUpdate) return null;
          
          const reviewDate = new Date(review.created_at);
          const updateDate = new Date(firstUpdate.created_at);
          return (updateDate.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24);
        }).filter(delay => delay !== null) as number[];

        const averageUpdateDays = updateDelays.length > 0 
          ? updateDelays.reduce((sum, days) => sum + days, 0) / updateDelays.length 
          : 0;

        console.log('Timeline summary calculation:', {
          initialRatings,
          latestRatings,
          averageInitialRating,
          averageLatestRating,
          totalUpdates: updates?.length || 0
        });

        live() && setSummary({
          averageInitialRating,
          averageLatestRating,
          averageUpdateDays,
          totalTimelineUpdates: updates?.length || 0,
          // Include entity-level AI summary data
          entityAiSummary: entityData?.ai_dynamic_review_summary || undefined,
          entityAiSummaryLastGenerated: entityData?.ai_dynamic_review_summary_last_generated_at || undefined,
          entityAiSummaryModel: entityData?.ai_dynamic_review_summary_model_used || undefined,
        });

      } catch (err) {
        console.error('Error fetching entity timeline summary:', err);
        live() && setError(err instanceof Error ? err.message : 'Failed to fetch timeline summary');
      } finally {
        live() && setIsLoading(false);
      }
    };

    fetchSummary();
    return () => { cancelled = true; };
  }, [entityId, refreshTick]);

  return { summary, isLoading, error };
};
