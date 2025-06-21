
import { supabase } from '@/integrations/supabase/client';
import { attachProfilesToEntities } from '@/services/enhancedUnifiedProfileService';
import { ReviewUpdate } from './types';

// Fetch review timeline updates
export const fetchReviewUpdates = async (reviewId: string): Promise<ReviewUpdate[]> => {
  try {
    // First get the review updates
    const { data: updates, error: updatesError } = await supabase
      .from('review_updates')
      .select('*')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false });

    if (updatesError) {
      console.error('Error fetching review updates:', updatesError);
      return [];
    }

    if (!updates?.length) return [];

    // Attach profiles using enhanced unified service
    const updatesWithProfiles = await attachProfilesToEntities(updates);

    // Map updates with their corresponding profiles
    return updatesWithProfiles.map(update => ({
      ...update,
      profiles: {
        username: update.user.displayName, // Use displayName consistently
        avatar_url: update.user.avatar_url
      }
    }));

  } catch (error) {
    console.error('Error in fetchReviewUpdates:', error);
    return [];
  }
};

export const addReviewUpdate = async (reviewId: string, userId: string, rating: number | null, comment: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('review_updates')
      .insert({
        review_id: reviewId,
        user_id: userId,
        rating: rating,
        comment: comment
      });

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
