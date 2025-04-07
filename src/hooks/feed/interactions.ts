
import { supabase } from '@/integrations/supabase/client';

// Toggle like for a recommendation or post
export const useInteractions = (onSuccess?: () => void) => {
  const handleLike = async (itemId: string, userId: string) => {
    try {
      const isPost = await isItemPost(itemId);
      
      if (isPost) {
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
      const isPost = await isItemPost(itemId);
      
      if (isPost) {
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

  const isItemPost = async (itemId: string): Promise<boolean> => {
    // Check if item exists in posts table
    const { data: post } = await supabase
      .from('posts')
      .select('id')
      .eq('id', itemId)
      .single();
      
    return Boolean(post);
  };
  
  const togglePostLike = async (postId: string, userId: string) => {
    try {
      // Check if like exists using rpc function
      const { data: existingLike, error: checkError } = await supabase
        .rpc('check_post_like', {
          p_post_id: postId,
          p_user_id: userId
        });
      
      if (checkError) {
        console.error('Error checking post like:', checkError);
        throw checkError;
      }
      
      // If like exists, remove it; otherwise, add it
      if (existingLike) {
        const { error: deleteError } = await supabase
          .rpc('delete_post_like', {
            p_post_id: postId,
            p_user_id: userId
          });
        
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .rpc('insert_post_like', {
            p_post_id: postId,
            p_user_id: userId
          });
          
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error in togglePostLike:', err);
      throw err;
    }
  };
  
  const togglePostSave = async (postId: string, userId: string) => {
    try {
      // Check if save exists using rpc function
      const { data: existingSave, error: checkError } = await supabase
        .rpc('check_post_save', {
          p_post_id: postId,
          p_user_id: userId
        });
      
      if (checkError) {
        console.error('Error checking post save:', checkError);
        throw checkError;
      }
      
      // If save exists, remove it; otherwise, add it
      if (existingSave) {
        const { error: deleteError } = await supabase
          .rpc('delete_post_save', {
            p_post_id: postId,
            p_user_id: userId
          });
          
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase
          .rpc('insert_post_save', {
            p_post_id: postId,
            p_user_id: userId
          });
          
        if (insertError) throw insertError;
      }
    } catch (err) {
      console.error('Error in togglePostSave:', err);
      throw err;
    }
  };
  
  const toggleRecommendationLike = async (recommendationId: string, userId: string) => {
    // Check if like exists
    const { data: existingLike, error: checkError } = await supabase
      .from('recommendation_likes')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId)
      .single();
      
    // If like exists, remove it; otherwise, add it
    if (existingLike) {
      await supabase
        .from('recommendation_likes')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('user_id', userId);
    } else {
      const { error } = await supabase
        .from('recommendation_likes')
        .insert({ recommendation_id: recommendationId, user_id: userId });
        
      if (error) {
        console.error('Error adding like:', error);
        throw error;
      }
    }
  };
  
  const toggleRecommendationSave = async (recommendationId: string, userId: string) => {
    // Check if save exists
    const { data: existingSave } = await supabase
      .from('recommendation_saves')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('user_id', userId)
      .single();
      
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
