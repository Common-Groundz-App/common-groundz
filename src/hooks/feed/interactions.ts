
import { supabase } from '@/integrations/supabase/client';
import { isItemPost } from './api/utils';

// Toggle like for a recommendation or post
export const useInteractions = () => {
  const handleLike = async (itemId: string, userId: string) => {
    try {
      if (!userId) {
        throw new Error('User ID is required to perform this action');
      }

      // Check if the item is a post by querying the posts table
      const { data: postData } = await supabase
        .from('posts')
        .select('id')
        .eq('id', itemId)
        .maybeSingle();
      
      const isPostItem = !!postData;
      
      if (isPostItem) {
        await togglePostLike(itemId, userId);
      } else {
        await toggleRecommendationLike(itemId, userId);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      throw err;
    }
  };

  const handleSave = async (itemId: string, userId: string) => {
    try {
      if (!userId) {
        throw new Error('User ID is required to perform this action');
      }
      
      // Check if the item is a post by querying the posts table
      const { data: postData } = await supabase
        .from('posts')
        .select('id')
        .eq('id', itemId)
        .maybeSingle();
      
      const isPostItem = !!postData;
      
      if (isPostItem) {
        await togglePostSave(itemId, userId);
      } else {
        await toggleRecommendationSave(itemId, userId);
      }
    } catch (err) {
      console.error('Error toggling save:', err);
      throw err;
    }
  };
  
  const togglePostLike = async (postId: string, userId: string) => {
    try {
      // Check if like exists using direct query instead of RPC function
      const { data: exists, error: checkError } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (exists) {
        const { error: deleteError } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
          
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: userId });
          
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error in togglePostLike:', err);
      throw err;
    }
  };
  
  const togglePostSave = async (postId: string, userId: string) => {
    try {
      // Check if save exists
      const { data: exists, error: checkError } = await supabase
        .from('post_saves')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (exists) {
        const { error: deleteError } = await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
          
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from('post_saves')
          .insert({ post_id: postId, user_id: userId });
          
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error in togglePostSave:', err);
      throw err;
    }
  };
  
  const toggleRecommendationLike = async (recommendationId: string, userId: string) => {
    try {
      // Check if like exists
      const { data: existingLike, error: checkError } = await supabase
        .from('recommendation_likes')
        .select('*')
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (checkError) throw checkError;
        
      // If like exists, remove it; otherwise, add it
      if (existingLike) {
        const { error: deleteError } = await supabase
          .from('recommendation_likes')
          .delete()
          .eq('recommendation_id', recommendationId)
          .eq('user_id', userId);
          
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from('recommendation_likes')
          .insert({ recommendation_id: recommendationId, user_id: userId });
          
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error in toggleRecommendationLike:', err);
      throw err;
    }
  };
  
  const toggleRecommendationSave = async (recommendationId: string, userId: string) => {
    try {
      // Check if save exists
      const { data: existingSave, error: checkError } = await supabase
        .from('recommendation_saves')
        .select('*')
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId)
        .maybeSingle();
        
      if (checkError) throw checkError;
        
      // If save exists, remove it; otherwise, add it
      if (existingSave) {
        const { error: deleteError } = await supabase
          .from('recommendation_saves')
          .delete()
          .eq('recommendation_id', recommendationId)
          .eq('user_id', userId);
          
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .from('recommendation_saves')
          .insert({ recommendation_id: recommendationId, user_id: userId });
          
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error in toggleRecommendationSave:', err);
      throw err;
    }
  };

  return { handleLike, handleSave };
};
