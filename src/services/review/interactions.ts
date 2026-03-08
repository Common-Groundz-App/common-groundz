
import { supabase } from '@/integrations/supabase/client';

export const toggleReviewLike = async (reviewId: string, userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('toggle_review_like', {
      p_review_id: reviewId,
      p_user_id: userId
    });

    if (error) {
      console.error('Error toggling review like:', error);
      return false;
    }

    return data;
  } catch (error) {
    console.error('Error in toggleReviewLike:', error);
    return false;
  }
};
