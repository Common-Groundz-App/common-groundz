
import { supabase } from '@/integrations/supabase/client';
import { isItemPost } from './api';

// Toggle like for a recommendation or post
export const useInteractions = (onSuccess?: () => void) => {
  const handleLike = async (itemId: string, userId: string) => {
    try {
      const isPostItem = await isItemPost(itemId);
      
      if (isPostItem) {
        await togglePostLike(itemId, userId);
      } else {
        await toggleRecommendationLike(itemId, userId);
      }
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error toggling like:', err);
      throw err;
    }
  };

  const handleSave = async (itemId: string, userId: string) => {
    try {
      const isPostItem = await isItemPost(itemId);
      
      if (isPostItem) {
        await togglePostSave(itemId, userId);
      } else {
        await toggleRecommendationSave(itemId, userId);
      }
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error toggling save:', err);
      throw err;
    }
  };
  
  const togglePostLike = async (postId: string, userId: string) => {
    try {
      // Check if like exists using direct query instead of RPC function
      const { data: exists } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (exists) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: userId });
      }
    } catch (err) {
      console.error('Error in togglePostLike:', err);
      throw err;
    }
  };
  
  const togglePostSave = async (postId: string, userId: string) => {
    try {
      // Check if save exists
      const { data: exists } = await supabase
        .from('post_saves')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (exists) {
        await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
      } else {
        await supabase
          .from('post_saves')
          .insert({ post_id: postId, user_id: userId });
      }
    } catch (err) {
      console.error('Error in togglePostSave:', err);
      throw err;
    }
  };
  
  const toggleRecommendationLike = async (recommendationId: string, userId: string) => {
    // Check if like exists
    const { data: existingLike } = await supabase
      .from('recommendation_likes')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId)
      .maybeSingle();
      
    // If like exists, remove it; otherwise, add it
    if (existingLike) {
      await supabase
        .from('recommendation_likes')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);
    } else {
      await supabase
        .from('recommendation_likes')
        .insert({ recommendation_id: recommendationId, user_id: userId });
    }
  };
  
  const toggleRecommendationSave = async (recommendationId: string, userId: string) => {
    // Check if save exists
    const { data: existingSave } = await supabase
      .from('recommendation_saves')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId)
      .maybeSingle();
      
    // If save exists, remove it; otherwise, add it
    if (existingSave) {
      await supabase
        .from('recommendation_saves')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);
    } else {
      await supabase
        .from('recommendation_saves')
        .insert({ recommendation_id: recommendationId, user_id: userId });
    }
  };

  return { handleLike, handleSave };
};
