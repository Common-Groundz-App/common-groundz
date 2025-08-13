
import { supabase } from '@/integrations/supabase/client';

/**
 * Create a new post
 */
export const createPost = async (postData: {
  content: string;
  post_type: string;
  visibility: string;
  media?: any[];
  tags?: string[];
}) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        title: 'Untitled',
        content: postData.content,
        post_type: postData.post_type,
        visibility: postData.visibility,
        media: postData.media || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

/**
 * Update an existing post
 */
export const updatePost = async (postId: string, updateData: {
  content?: string;
  media?: any[];
  tags?: string[];
}) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .update({
        content: updateData.content,
        media: updateData.media,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

/**
 * Toggle like for a post
 * @param postId The ID of the post to toggle like for
 * @param userId The ID of the user doing the liking
 * @returns Boolean indicating if the post is now liked (true) or unliked (false)
 */
export const toggleLike = async (postId: string, userId: string): Promise<boolean> => {
  try {
    // Check if post is already liked
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

    const isLiked = !!existingLike;

    if (isLiked) {
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
 * @returns Boolean indicating if the post is now saved (true) or unsaved (false)
 */
export const toggleSave = async (postId: string, userId: string): Promise<boolean> => {
  try {
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

    const isSaved = !!existingSave;

    if (isSaved) {
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
