
import { supabase } from '@/integrations/supabase/client';
import { Comment, CreateCommentParams, FetchCommentsParams } from './types';
import { fetchProfiles } from '../feed/api/profiles';
import { createMap } from '../feed/api/utils';
import { useAuth } from '@/contexts/AuthContext';

// Fetch comments for a post or recommendation
export const fetchComments = async (params: FetchCommentsParams): Promise<Comment[]> => {
  try {
    const { target, parent_id } = params;
    
    // Build query based on target type
    let query = supabase.from('comments').select('*');
    
    // Filter by parent_id (for top-level comments or replies)
    if (parent_id === null) {
      // Get only top-level comments (no parent)
      query = query.is('parent_id', null);
    } else if (parent_id) {
      // Get replies to a specific comment
      query = query.eq('parent_id', parent_id);
    }
    
    // Filter by target (post or recommendation)
    if (target.type === 'post') {
      query = query.eq('post_id', target.id).is('recommendation_id', null);
    } else {
      query = query.eq('recommendation_id', target.id).is('post_id', null);
    }
    
    // Get only non-deleted comments, sorted by newest first
    query = query.eq('is_deleted', false).order('created_at', { ascending: false });
    
    const { data: comments, error } = await query;
    
    if (error) throw error;
    if (!comments || comments.length === 0) return [];
    
    // Get all user IDs to fetch profiles
    const userIds = [...new Set(comments.map(comment => comment.user_id))];
    
    // Fetch profiles for the comment authors
    const { data: profilesData } = await fetchProfiles(userIds);
    const profilesMap = createMap(profilesData, 'id');
    
    // Count replies for each parent comment if we're fetching top-level comments
    const repliesCount: Record<string, number> = {};
    
    if (parent_id === null) {
      const { data: counts, error: countError } = await supabase
        .from('comments')
        .select('parent_id, count(*)')
        .in('parent_id', comments.map(c => c.id))
        .eq('is_deleted', false)
        .group('parent_id');
      
      if (!countError && counts) {
        counts.forEach((item: any) => {
          repliesCount[item.parent_id] = parseInt(item.count, 10);
        });
      }
    }
    
    // Enhance comments with profile data and replies count
    return comments.map(comment => {
      const profile = profilesMap.get(comment.user_id);
      
      return {
        ...comment,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        replies_count: repliesCount[comment.id] || 0
      };
    });
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
    const { data, error } = await supabase
      .from('comments')
      .insert(commentData)
      .select('*')
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Failed to create comment');
    
    // Get user profile for the comment
    const { data: profileData } = await fetchProfiles([user.id]);
    const profile = profileData?.[0] || null;
    
    return {
      ...data,
      username: profile?.username || null,
      avatar_url: profile?.avatar_url || null,
      replies_count: 0,
      is_own_comment: true
    };
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
      
    if (error) throw error;
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
      
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};
