
import { supabase } from '@/integrations/supabase/client';

// Export the functions to satisfy import requirements
export const toggleRecommendationLike = async (recommendationId: string, userId: string) => {
  return toggleLike(recommendationId, userId, false);
};

export const toggleRecommendationSave = async (recommendationId: string, userId: string) => {
  return toggleSave(recommendationId, userId, false);
};

// This function is kept here for consistency with the service structure,
// but the main implementation is now in recommendationService.ts
export const toggleLike = async (recommendationId: string, userId: string, isLiked: boolean) => {
  try {
    // Direct approach to add or remove the like based on current state
    if (isLiked) {
      // Remove like
      const { error } = await supabase
        .from('recommendation_likes')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing like:', error);
        throw error;
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
        throw error;
      }
    }

    return !isLiked;
  } catch (error) {
    console.error('Error in toggleLike:', error);
    throw error;
  }
};

export const toggleSave = async (recommendationId: string, userId: string, isSaved: boolean) => {
  if (isSaved) {
    // Remove save
    const { error } = await supabase
      .from('recommendation_saves')
      .delete()
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing save:', error);
      throw error;
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
      throw error;
    }
  }

  return !isSaved;
};
