
import { supabase } from '@/integrations/supabase/client';
import { notifyReviewsChanged } from './reviewChangeEvents';
import { Review, ReviewCreateData, ReviewUpdateData } from './types';

// Create a new review
export const createReview = async (reviewData: ReviewCreateData): Promise<Review> => {
  try {
    // Phase 2.4 — client-side guard before DB trigger rejects it.
    if (!reviewData.entity_id) {
      throw new Error('A review must be linked to a subject.');
    }
    if (!reviewData.category) {
      throw new Error('Category is required when a subject is linked.');
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert(reviewData)
      .select()
      .single();

    if (error) {
      console.error('Error creating review:', error);
      throw error;
    }

    notifyReviewsChanged();
    return data;
  } catch (error) {
    console.error('Error in createReview:', error);
    throw error;
  }
};

// Update an existing review
export const updateReview = async (reviewId: string, updates: ReviewUpdateData): Promise<Review> => {
  try {
    // Phase 2.4 — client-side guard for linked updates.
    if (updates.entity_id === '') {
      throw new Error('A review may not be unlinked from its subject.');
    }
    if (updates.entity_id && !updates.category) {
      throw new Error('Category is required when a subject is linked.');
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Error updating review:', error);
      throw error;
    }

    notifyReviewsChanged();
    return data;
  } catch (error) {
    console.error('Error in updateReview:', error);
    throw error;
  }
};

// Delete a review
export const deleteReview = async (reviewId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return false;
    }

    notifyReviewsChanged();
    return true;
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return false;
  }
};

/**
 * Step 2 — delete a whole review thread (review + all timeline updates) in one
 * server transaction. Afterwards, best-effort cleanup of the owner's own
 * uploaded files the server confirmed are unused. Cleanup never blocks or
 * undoes the delete.
 */
export const deleteReviewThread = async (
  reviewId: string,
): Promise<'deleted' | 'not_found' | 'unauthorized' | 'error'> => {
  try {
    const { data, error } = await supabase.rpc('delete_review_thread', { p_review_id: reviewId });
    if (error) {
      console.error('Error deleting review thread:', error);
      return 'error';
    }
    const result = data as { status?: string; mediaToClean?: string[] } | null;
    const status = result?.status;
    if (status !== 'deleted') {
      return status === 'not_found' || status === 'unauthorized' ? status : 'error';
    }
    notifyReviewsChanged();
    // Saved photos are queued for server-side cleanup by the database in the
    // same transaction; the browser never deletes persisted media.
    return 'deleted';
  } catch (error) {
    console.error('Error in deleteReviewThread:', error);
    return 'error';
  }
};

/**
 * Confirmed existence check. `gone` only when the query succeeded and returned
 * no row; a failed request is `error`, never `gone`.
 */
export const checkReviewExists = async (
  reviewId: string,
): Promise<'exists' | 'gone' | 'error'> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .maybeSingle();
    if (error) return 'error';
    return data ? 'exists' : 'gone';
  } catch {
    return 'error';
  }
};

/** Retryable, silent media cleanup (one retry per file). */
export const cleanupReviewMedia = async (urls: string[]): Promise<void> => {
  const { deleteMedia } = await import('@/services/mediaService');
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (!(await deleteMedia(url))) await deleteMedia(url);
      } catch {
        /* silent: orphan sweep handles leftovers */
      }
    }),
  );
};

// Update review status (for admin actions)
export const updateReviewStatus = async (reviewId: string, status: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', reviewId);

    if (error) {
      console.error('Error updating review status:', error);
      return false;
    }

    notifyReviewsChanged();
    return true;
  } catch (error) {
    console.error('Error in updateReviewStatus:', error);
    return false;
  }
};

