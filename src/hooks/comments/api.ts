
import { supabase } from '@/integrations/supabase/client';
import { Comment, CreateCommentParams, FetchCommentsParams } from './types';

// Fetch comments for a post or recommendation
export const fetchComments = async (params: FetchCommentsParams): Promise<Comment[]> => {
  try {
    const { target, parent_id } = params;
    
    let query = supabase
      .from('comments')
      .select('*, profiles:user_id(username, avatar_url)')
      .eq('is_deleted', false);
    
    // Filter by parent_id (for top-level comments or replies)
    if (parent_id === null) {
      query = query.is('parent_id', null);
    } else if (parent_id) {
      query = query.eq('parent_id', parent_id);
    }
    
    // Filter by target (post or recommendation)
    if (target.type === 'post') {
      query = query.eq('post_id', target.id).is('recommendation_id', null);
    } else {
      query = query.eq('recommendation_id', target.id).is('post_id', null);
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data: comments, error } = await query;
    
    if (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
    
    if (!comments || comments.length === 0) return [];
    
    // Count replies for each parent comment if we're fetching top-level comments
    const repliesCounts: Record<string, number> = {};
    
    if (parent_id === null && comments.length > 0) {
      // Get IDs of all returned comments
      const commentIds = comments.map(c => c.id);
      
      if (commentIds.length > 0) {
        const { data: repliesData, error: countError } = await supabase
          .from('comments')
          .select('parent_id, count(*)')
          .in('parent_id', commentIds)
          .eq('is_deleted', false)
          .group('parent_id');
        
        if (!countError && repliesData) {
          repliesData.forEach((item: any) => {
            repliesCounts[item.parent_id] = parseInt(item.count, 10);
          });
        }
      }
    }
    
    // Enhance comments with profile data and replies count
    return comments.map((comment: any) => ({
      ...comment,
      username: comment.profiles?.username,
      avatar_url: comment.profiles?.avatar_url,
      replies_count: repliesCounts[comment.id] || 0,
      is_own_comment: comment.user_id === (supabase.auth.getUser())?.data?.user?.id
    })) as Comment[];
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

// Create a new comment
export const createComment = async (params: CreateCommentParams): Promise<Comment> => {
  try {
    const { content, target, parent_id } = params;
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) throw new Error('User not authenticated');
    
    // Prepare comment data based on target type
    const commentData = {
      content,
      user_id: user.id,
      parent_id: parent_id || null,
      post_id: target.type === 'post' ? target.id : null,
      recommendation_id: target.type === 'recommendation' ? target.id : null
    };
    
    // Insert comment
    const { data: newComment, error } = await supabase
      .from('comments')
      .insert(commentData)
      .select('*')
      .single();
    
    if (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
    
    if (!newComment) throw new Error('Failed to create comment');
    
    // Get user profile for the comment
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }
    
    const commentWithProfile = {
      ...newComment,
      username: profileData?.username || null,
      avatar_url: profileData?.avatar_url || null,
      replies_count: 0,
      is_own_comment: true
    };
    
    return commentWithProfile as Comment;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

// Update a comment
export const updateComment = async (id: string, content: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', id);
      
    if (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

// Delete a comment (soft delete)
export const deleteComment = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};
