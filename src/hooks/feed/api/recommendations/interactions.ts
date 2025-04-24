
import { supabase } from '@/integrations/supabase/client';

// Toggle recommendation like
export const toggleRecommendationLike = async (recommendationId: string, userId: string): Promise<boolean> => {
  try {
    // Check if like exists
    const { data: existingLike, error: checkError } = await supabase
      .from('recommendation_likes')
      .select('id')
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGSQL_ERROR') {
      console.error('Error checking recommendation like:', checkError);
      throw checkError;
    }

    if (existingLike) {
      // Remove like
      const { error: deleteError } = await supabase
        .from('recommendation_likes')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
      return false;
    } else {
      // Add like
      const { error: insertError } = await supabase
        .from('recommendation_likes')
        .insert({
          recommendation_id: recommendationId,
          user_id: userId
        });

      if (insertError) throw insertError;
      return true;
    }
  } catch (error) {
    console.error('Error toggling recommendation like:', error);
    throw error;
  }
};

// Toggle recommendation save
export const toggleRecommendationSave = async (recommendationId: string, userId: string): Promise<boolean> => {
  try {
    // Check if save exists
    const { data: existingSave, error: checkError } = await supabase
      .from('recommendation_saves')
      .select('id')
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGSQL_ERROR') {
      console.error('Error checking recommendation save:', checkError);
      throw checkError;
    }

    if (existingSave) {
      // Remove save
      const { error: deleteError } = await supabase
        .from('recommendation_saves')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
      return false;
    } else {
      // Add save
      const { error: insertError } = await supabase
        .from('recommendation_saves')
        .insert({
          recommendation_id: recommendationId,
          user_id: userId
        });

      if (insertError) throw insertError;
      return true;
    }
  } catch (error) {
    console.error('Error toggling recommendation save:', error);
    throw error;
  }
};

// Export everything from the module
export * from './interactions';
