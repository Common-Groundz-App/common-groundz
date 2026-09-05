
import { supabase } from '@/integrations/supabase/client';
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

    return true;
  } catch (error) {
    console.error('Error in deleteReview:', error);
    return false;
  }
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

    return true;
  } catch (error) {
    console.error('Error in updateReviewStatus:', error);
    return false;
  }
};

