
import { supabase } from '@/integrations/supabase/client';

export const toggleLike = async (recommendationId: string, userId: string, isLiked: boolean) => {
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
