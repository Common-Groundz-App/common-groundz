
import { supabase } from '@/integrations/supabase/client';

export const toggleRecommendationLike = async (recommendationId: string, userId: string, isLiked: boolean) => {
  try {
    if (isLiked) {
      // Remove like
      const { error } = await supabase
        .from('recommendation_likes')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing like:', error);
        return false;
      }
    } else {
      // Add like
      const { error } = await supabase
        .from('recommendation_likes')
        .insert({
          recommendation_id: recommendationId,
          user_id: userId
        });

      if (error) {
        console.error('Error adding like:', error);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error toggling like:', error);
    return false;
  }
};

export const toggleRecommendationSave = async (recommendationId: string, userId: string, isSaved: boolean) => {
  try {
    if (isSaved) {
      // Remove save
      const { error } = await supabase
        .from('recommendation_saves')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing save:', error);
        return false;
      }
    } else {
      // Add save
      const { error } = await supabase
        .from('recommendation_saves')
        .insert({
          recommendation_id: recommendationId,
          user_id: userId
        });

      if (error) {
        console.error('Error adding save:', error);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error toggling save:', error);
    return false;
  }
};
