
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

    // Build the query
    let query = supabase
      .from('comments')
      .select(`*`)
      .eq(field, itemId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Handle parent_id filtering (for top-level vs replies)
    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null);
    }

    const { data: comments, error } = await query;

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

    // Check if there are more comments - build and execute a count query
    let countQuery = supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq(field, itemId)
      .eq('is_deleted', false);
      
    if (parentId) {
      countQuery = countQuery.eq('parent_id', parentId);
    } else {
      countQuery = countQuery.is('parent_id', null);
    }
    
    const { count, error: countError } = await countQuery;

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
    
    const insertData: any = {
      content,
      user_id: userId,
      [field]: itemId,
      is_deleted: false
    };
    
    // Only add parent_id if it's provided and not null
    if (parentId) {
      insertData.parent_id = parentId;
    }
    
    const { data, error } = await supabase
      .from('comments')
      .insert(insertData)
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
    // Changed from update to proper soft delete pattern
    // The RLS policy issue likely means we should use UPDATE instead of DELETE
    // And we should update is_deleted to true instead of removing the row
    const { error } = await supabase
      .from('comments')
      .update({ 
        is_deleted: true,
        content: 'This comment has been deleted.',  // Add clear indication it's deleted
        updated_at: new Date().toISOString() 
      })
      .eq('id', commentId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting comment:', err);
    throw err;
  }
};
