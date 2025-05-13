
import { supabase } from '@/integrations/supabase/client';

/**
 * Toggle like for a post
 * @param postId The ID of the post to toggle like for
 * @param userId The ID of the user doing the liking
 * @param isLiked Optional parameter to explicitly set the like state
 * @returns Boolean indicating if the post is now liked (true) or unliked (false)
 */
export const toggleLike = async (postId: string, userId: string, isLiked?: boolean): Promise<boolean> => {
  try {
    // If isLiked is provided, use it to determine the operation
    if (isLiked !== undefined) {
      if (isLiked) {
        // Remove like if it's already liked
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) {
          console.error('Error removing like:', error);
          throw error;
        }
        return false;
      } else {
        // Add like if it's not liked
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: userId
          });

        if (error) {
          console.error('Error adding like:', error);
          throw error;
        }
        return true;
      }
    }

    // If isLiked is not provided, check if post is already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking like status:', checkError);
      throw checkError;
    }

    const isCurrentlyLiked = !!existingLike;

    if (isCurrentlyLiked) {
      // Remove like
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing like:', error);
        throw error;
      }
      return false;
    } else {
      // Add like
      const { error } = await supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: userId
        });

      if (error) {
        console.error('Error adding like:', error);
        throw error;
      }
      return true;
    }
  } catch (error) {
    console.error('Error in togglePostLike:', error);
    throw error;
  }
};

/**
 * Toggle save for a post
 * @param postId The ID of the post to toggle save for
 * @param userId The ID of the user doing the saving
 * @param isSaved Optional parameter to explicitly set the save state
 * @returns Boolean indicating if the post is now saved (true) or unsaved (false)
 */
export const toggleSave = async (postId: string, userId: string, isSaved?: boolean): Promise<boolean> => {
  try {
    // If isSaved is provided, use it to determine the operation
    if (isSaved !== undefined) {
      if (isSaved) {
        // Remove save if it's already saved
        const { error } = await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) {
          console.error('Error removing save:', error);
          throw error;
        }
        return false;
      } else {
        // Add save if it's not saved
        const { error } = await supabase
          .from('post_saves')
          .insert({
            post_id: postId,
            user_id: userId
          });

        if (error) {
          console.error('Error adding save:', error);
          throw error;
        }
        return true;
      }
    }

    // Check if post is already saved
    const { data: existingSave, error: checkError } = await supabase
      .from('post_saves')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking save status:', checkError);
      throw checkError;
    }

    const isCurrentlySaved = !!existingSave;

    if (isCurrentlySaved) {
      // Remove save
      const { error } = await supabase
        .from('post_saves')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing save:', error);
        throw error;
      }
      return false;
    } else {
      // Add save
      const { error } = await supabase
        .from('post_saves')
        .insert({
          post_id: postId,
          user_id: userId
        });

      if (error) {
        console.error('Error adding save:', error);
        throw error;
      }
      return true;
    }
  } catch (error) {
    console.error('Error in togglePostSave:', error);
    throw error;
  }
};
