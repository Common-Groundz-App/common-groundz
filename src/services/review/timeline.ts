import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { attachProfilesToEntities } from '@/services/enhancedUnifiedProfileService';
import { ReviewUpdate } from './types';
import { MediaItem } from '@/types/media';

/**
 * Three-state result for the dedicated latest-intent lookup.
 *
 * `found`  — there is an authoritative non-null intent event.
 * `none`   — the review has no intent-bearing timeline rows.
 * `error`  — the query failed; callers must not claim provenance.
 */
export type LatestIntentResult =
  | { status: 'found'; event: ReviewUpdate }
  | { status: 'none' }
  | { status: 'error' };

/** Values the `review_updates.would_recommend` column accepts. */
export type WouldRecommendValue = 'yes' | 'maybe' | 'no' | 'auto' | null;

// Fetch review timeline updates
export const fetchReviewUpdates = async (reviewId: string): Promise<ReviewUpdate[]> => {
  try {
    // First get the review updates including media.
    // Order by created_at DESC, id DESC so the visible list agrees with the SQL
    // resolver and the undo RPC on which entry is newest when timestamps tie.
    const { data: updates, error: updatesError } = await supabase
      .from('review_updates')
      .select('*')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (updatesError) {
      console.error('Error fetching review updates:', updatesError);
      return [];
    }

    if (!updates?.length) return [];

    // Attach profiles using enhanced unified service
    const updatesWithProfiles = await attachProfilesToEntities(updates);

    // Map updates with their corresponding profiles and parse media
    return updatesWithProfiles.map(update => {
      let parsedMedia: MediaItem[] = [];
      try {
        if (update.media && Array.isArray(update.media)) {
          parsedMedia = update.media as unknown as MediaItem[];
        }
      } catch (error) {
        console.warn('Failed to parse media for update:', update.id, error);
      }
      
      return {
        ...update,
        would_recommend: update.would_recommend as ReviewUpdate['would_recommend'],
        media: parsedMedia,
        profiles: {
          username: update.user.displayName, // Use displayName consistently
          avatar_url: update.user.avatar_url
        }
      } as ReviewUpdate;
    });

  } catch (error) {
    console.error('Error in fetchReviewUpdates:', error);
    return [];
  }
};

/**
 * Fetch the single newest intent-bearing timeline row for a review.
 *
 * This is the authoritative source for recommendation provenance. It uses a
 * LIMIT 1 query so it does not depend on whether the visible timeline list is
 * complete (PostgREST may cap unrestricted responses).
 */
export const fetchLatestRecommendationIntent = async (
  reviewId: string,
): Promise<LatestIntentResult> => {
  try {
    const { data, error } = await supabase
      .from('review_updates')
      .select('*')
      .eq('review_id', reviewId)
      .not('would_recommend', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest recommendation intent:', error);
      return { status: 'error' };
    }

    if (!data) {
      return { status: 'none' };
    }

    return { status: 'found', event: data as unknown as ReviewUpdate };
  } catch (error) {
    console.error('Error in fetchLatestRecommendationIntent:', error);
    return { status: 'error' };
  }
};

export const addReviewUpdate = async (
  reviewId: string,
  userId: string,
  rating: number | null,
  comment: string,
  media?: MediaItem[],
  wouldRecommend?: WouldRecommendValue,
): Promise<boolean> => {
  try {
    // Shaped to match the generated `review_updates` Insert row: `rating` is
    // omitted rather than sent as null, and `media` is stored as JSON.
    const insert: {
      review_id: string;
      user_id: string;
      rating?: number;
      comment: string;
      media?: Json;
      would_recommend?: string;
    } = {
      review_id: reviewId,
      user_id: userId,
      comment: comment,
      media: (media || []) as unknown as Json,
    };

    if (rating !== null && rating !== undefined) {
      insert.rating = rating;
    }

    // Only write the column when the user made an explicit statement.
    // `null` / `undefined` means "no recommendation statement" and the column
    // is omitted so the previous non-null intent stays authoritative.
    if (wouldRecommend !== null && wouldRecommend !== undefined) {
      insert.would_recommend = wouldRecommend;
    }

    const { error } = await supabase
      .from('review_updates')
      .insert(insert);

    if (error) {
      console.error('Error adding review update:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in addReviewUpdate:', error);
    return false;
  }
};

/**
 * Undo the newest timeline entry for a review.
 *
 * Wraps the Stage 1 RPC `delete_latest_review_update`, which enforces ownership
 * and takes the per-review advisory lock.
 */
export const deleteLatestReviewUpdate = async (
  reviewId: string,
  expectedUpdateId: string,
): Promise<'deleted' | 'conflict' | 'not_found' | 'error'> => {
  try {
    const { data, error } = await supabase.rpc('delete_latest_review_update', {
      p_review_id: reviewId,
      p_expected_update_id: expectedUpdateId,
    });

    if (error) {
      console.error('Error deleting latest review update:', error);
      return 'error';
    }

    const status = (data as { status?: string } | null)?.status;
    if (status === 'deleted') return 'deleted';
    if (status === 'conflict') return 'conflict';
    if (status === 'not_found') return 'not_found';
    return 'error';
  } catch (error) {
    console.error('Error in deleteLatestReviewUpdate:', error);
    return 'error';
  }
};
