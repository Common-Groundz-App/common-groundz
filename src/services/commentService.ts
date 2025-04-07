import { supabase } from '@/integrations/supabase/client';
import { CommentWithUser } from '@/types/comment';
import { fetchProfiles } from '@/hooks/feed/api/profiles';

// Get comments for a post or recommendation
export const getComments = async (
  itemId: string,
  itemType: 'post' | 'recommendation',
  parentId: string | null = null,
  limit: number = 10,
  page: number = 0
): Promise<{ comments: CommentWithUser[]; hasMore: boolean }> => {
  try {
    // Fetch comments
    const field = itemType === 'post' ? 'post_id' : 'recommendation_id';
    const offset = page * limit;

    // Query the comments
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`*`)
      .eq(field, itemId)
      .eq('parent_id', parentId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    if (!comments || comments.length === 0) return { comments: [], hasMore: false };

    // Extract all unique user IDs
    const userIds = [...new Set(comments.map(comment => comment.user_id))];

    // Fetch profiles for these users
    const { data: profiles, error: profilesError } = await fetchProfiles(userIds);

    if (profilesError) throw profilesError;

    // Create a map for quick lookup
    const profilesMap = new Map();
    if (profiles) {
      profiles.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });
    }

    // Join the comments with user data
    const commentsWithUsers = comments.map(comment => {
      const profile = profilesMap.get(comment.user_id) || {
        username: 'Anonymous',
        avatar_url: null
      };

      return {
        ...comment,
        username: profile.username,
        avatar_url: profile.avatar_url,
      };
    });

    // Check if there are more comments
    const { count, error: countError } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq(field, itemId)
      .eq('parent_id', parentId)
      .eq('is_deleted', false);

    if (countError) throw countError;
    const hasMore = count ? count > offset + comments.length : false;

    return {
      comments: commentsWithUsers,
      hasMore
    };
  } catch (err) {
    console.error('Error fetching comments:', err);
    throw err;
  }
};

// Get reply count for a comment
export const getReplyCount = async (commentId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', commentId)
      .eq('is_deleted', false);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('Error getting reply count:', err);
    return 0;
  }
};

// Create a new comment
export const createComment = async (
  content: string, 
  userId: string,
  itemId: string,
  itemType: 'post' | 'recommendation',
  parentId: string | null = null
): Promise<any> => {
  try {
    const field = itemType === 'post' ? 'post_id' : 'recommendation_id';
    
    const { data, error } = await supabase
      .from('comments')
      .insert({
        content,
        user_id: userId,
        [field]: itemId,
        parent_id: parentId,
        is_deleted: false
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating comment:', err);
    throw err;
  }
};

// Update a comment
export const updateComment = async (
  commentId: string,
  content: string
): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating comment:', err);
    throw err;
  }
};

// Delete a comment (soft delete)
export const deleteComment = async (commentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', commentId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting comment:', err);
    throw err;
  }
};
