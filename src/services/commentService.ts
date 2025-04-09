
import { supabase } from '@/integrations/supabase/client';
import { 
  Comment, 
  CommentWithUser, 
  CreateCommentPayload, 
  UpdateCommentPayload, 
  CommentQueryParams 
} from '@/hooks/comments/types';

/**
 * Fetches comments based on provided parameters
 */
export const fetchComments = async (params: CommentQueryParams, userId?: string): Promise<CommentWithUser[]> => {
  try {
    const { post_id, recommendation_id, parent_id, limit = 10, offset = 0 } = params;
    
    // Build base query
    let query = supabase
      .from('comments')
      .select(`
        *,
        profiles(id, username, avatar_url)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    // Apply filters
    if (post_id) {
      query = query.eq('post_id', post_id);
    }
    
    if (recommendation_id) {
      query = query.eq('recommendation_id', recommendation_id);
    }
    
    // Handle parent_id filter (null for top-level comments, specific ID for replies)
    if (parent_id === null) {
      query = query.is('parent_id', null);
    } else if (parent_id) {
      query = query.eq('parent_id', parent_id);
    }
    
    const { data: comments, error } = await query;
    
    if (error) throw error;
    
    if (!comments || comments.length === 0) {
      return [];
    }
    
    // Process comments to add profile information
    const processedComments = comments.map((comment: any) => {
      const profile = comment.profiles as any | null;
      
      return {
        ...comment,
        profiles: undefined, // Remove the profiles object
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        like_count: 0, // Will be updated
        is_liked: false, // Will be updated
        reply_count: 0 // Will be updated
      } as CommentWithUser;
    });
    
    // Get comment IDs for further queries
    const commentIds = processedComments.map(comment => comment.id);
    
    if (commentIds.length > 0) {
      // Get like counts - Fix: Use a traditional count approach instead of groupBy
      // We'll query each comment's likes separately
      for (const comment of processedComments) {
        // Get like count for this comment
        const { count, error: countError } = await supabase
          .from('comment_likes')
          .select('*', { count: 'exact', head: true })
          .eq('comment_id', comment.id);
        
        if (!countError && count !== null) {
          comment.like_count = count;
        }
      }
      
      // Get like status for current user
      if (userId) {
        const { data: userLikesData, error: userLikesError } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', userId);
          
        if (userLikesError) {
          console.error('Error fetching user comment likes:', userLikesError);
        } else if (userLikesData) {
          // Set is_liked flag for comments liked by user
          userLikesData.forEach((like: any) => {
            const comment = processedComments.find(c => c.id === like.comment_id);
            if (comment) {
              comment.is_liked = true;
            }
          });
        }
      }
      
      // Get reply counts for top-level comments
      if (parent_id === null) {
        for (const comment of processedComments) {
          try {
            // Use simple count query instead of RPC function
            const { count, error: countError } = await supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('parent_id', comment.id)
              .eq('is_deleted', false);
              
            if (countError) {
              console.error('Error fetching reply count:', countError);
            } else {
              comment.reply_count = count || 0;
            }
          } catch (err) {
            console.error(`Error getting reply count for comment ${comment.id}:`, err);
          }
        }
      }
    }
    
    return processedComments;
  } catch (error) {
    console.error('Error in fetchComments:', error);
    throw error;
  }
};

/**
 * Creates a new comment
 */
export const createComment = async (data: CreateCommentPayload, userId: string): Promise<Comment> => {
  try {
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        content: data.content,
        post_id: data.post_id || null,
        recommendation_id: data.recommendation_id || null,
        parent_id: data.parent_id || null,
        user_id: userId
      })
      .select('*')
      .single();
    
    if (error) throw error;
    
    return comment as Comment;
  } catch (error) {
    console.error('Error in createComment:', error);
    throw error;
  }
};

/**
 * Updates an existing comment
 */
export const updateComment = async (id: string, data: UpdateCommentPayload, userId: string): Promise<Comment> => {
  try {
    const { data: comment, error } = await supabase
      .from('comments')
      .update({
        content: data.content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId) // Ensure user owns this comment
      .select('*')
      .single();
    
    if (error) throw error;
    
    return comment as Comment;
  } catch (error) {
    console.error('Error in updateComment:', error);
    throw error;
  }
};

/**
 * Soft-deletes a comment (marks as deleted)
 */
export const deleteComment = async (id: string, userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteComment:', error);
    throw error;
  }
};

/**
 * Toggles like status for a comment
 */
export const toggleCommentLike = async (commentId: string, userId: string): Promise<boolean> => {
  try {
    // Check if like exists
    const { data: existingLike, error: checkError } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    if (existingLike) {
      // Unlike
      const { error: deleteError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;
      
      return false; // Indicates comment is now unliked
    } else {
      // Like
      const { error: insertError } = await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: userId });
      
      if (insertError) throw insertError;
      
      return true; // Indicates comment is now liked
    }
  } catch (error) {
    console.error('Error in toggleCommentLike:', error);
    throw error;
  }
};

/**
 * Get the count of likes for a comment
 */
export const getCommentLikeCount = async (commentId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('comment_likes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId);
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    console.error('Error in getCommentLikeCount:', error);
    throw error;
  }
};
