
import { supabase } from '@/integrations/supabase/client';
import { Comment, AddCommentData, UpdateCommentData } from '@/hooks/feed/types';
import { fetchProfiles } from '@/hooks/feed/api/profiles';
import { createMap } from '@/hooks/feed/api/utils';

// Fetch comments for a post or recommendation
export const fetchComments = async (params: {
  postId?: string;
  recommendationId?: string;
  parentId?: string | null;
  userId: string;
}) => {
  const { postId, recommendationId, parentId, userId } = params;
  
  try {
    // Build query based on target and parent
    let query = supabase
      .from('comments')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (parentId !== undefined) {
      // Fetch replies to a specific comment
      query = query.eq('parent_id', parentId);
    } else {
      // Fetch root level comments for a post or recommendation
      query = query.is('parent_id', null);
      
      if (postId) {
        query = query.eq('post_id', postId);
      } else if (recommendationId) {
        query = query.eq('recommendation_id', recommendationId);
      }
    }
    
    const { data: commentsData, error } = await query;
    
    if (error) throw error;
    if (!commentsData || commentsData.length === 0) return [];
    
    // Get user profiles for all comments
    const userIds = commentsData.map(comment => comment.user_id);
    const { data: profilesData } = await fetchProfiles(userIds);
    const profilesMap = createMap(profilesData, 'id');
    
    // Get reply counts for comments
    const commentIds = commentsData.map(comment => comment.id);
    const replyCounts = await getCommentReplyCounts(commentIds);
    
    // Process comments with user profile information
    const processedComments = commentsData.map(comment => {
      const profile = profilesMap.get(comment.user_id);
      return {
        ...comment,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        replyCount: replyCounts.get(comment.id) || 0,
        showReplies: false
      };
    });
    
    return processedComments as Comment[];
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

// Get reply counts for multiple comments
export const getCommentReplyCounts = async (commentIds: string[]) => {
  if (!commentIds.length) return new Map<string, number>();
  
  try {
    const replyCounts = new Map<string, number>();
    
    // Get reply count for each comment
    for (const commentId of commentIds) {
      const { data, error } = await supabase.rpc('get_comment_reply_count', { 
        comment_id: commentId 
      });
      
      if (error) {
        console.error(`Error getting reply count for comment ${commentId}:`, error);
      } else {
        replyCounts.set(commentId, data || 0);
      }
    }
    
    return replyCounts;
  } catch (error) {
    console.error('Error getting comment reply counts:', error);
    return new Map<string, number>();
  }
};

// Add a new comment
export const addComment = async (commentData: AddCommentData) => {
  try {
    const { content, post_id, recommendation_id, parent_id } = commentData;
    
    const { data, error } = await supabase
      .from('comments')
      .insert({
        content,
        post_id: post_id || null,
        recommendation_id: recommendation_id || null,
        parent_id: parent_id || null,
        user_id: supabase.auth.getUser().then(res => res.data.user?.id || '')
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as Comment;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

// Update an existing comment
export const updateComment = async ({ id, content }: UpdateCommentData) => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Comment;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

// Soft delete a comment
export const deleteComment = async (commentId: string) => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', commentId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Comment;
  } catch (error) {
    console.error('Error soft deleting comment:', error);
    throw error;
  }
};

// Hard delete a comment (for testing purposes)
export const hardDeleteComment = async (commentId: string) => {
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error hard deleting comment:', error);
    throw error;
  }
};
