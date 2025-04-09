
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
export const fetchComments = async (params: CommentQueryParams, userId?: string): Promise<{comments: CommentWithUser[], totalCount: number}> => {
  try {
    const { post_id, recommendation_id, parent_id, limit = 10, offset = 0 } = params;
    
    // Simple query with join to profiles
    let query = supabase
      .from('comments')
      .select(`
        *,
        profiles (username, avatar_url)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
      
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
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    // Execute query
    const { data: commentsData, error } = await query;
    
    if (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }

    console.log('Fetched comments:', commentsData?.length || 0);
    
    // Get total count for pagination
    let totalCount = 0;
    try {
      const countQuery = supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false);
        
      if (post_id) {
        countQuery.eq('post_id', post_id);
      }
      
      if (recommendation_id) {
        countQuery.eq('recommendation_id', recommendation_id);
      }
      
      if (parent_id === null) {
        countQuery.is('parent_id', null);
      } else if (parent_id) {
        countQuery.eq('parent_id', parent_id);
      }
      
      const { count, error: countError } = await countQuery;
      if (!countError && count !== null) {
        totalCount = count;
      }
    } catch (countErr) {
      console.error('Error fetching comment count:', countErr);
      // Don't throw here, we can still return comments without the count
    }
    
    if (!commentsData || commentsData.length === 0) {
      console.log('No comments found');
      return { comments: [], totalCount };
    }
    
    // Process comments and extract profile data
    const processedComments: CommentWithUser[] = commentsData.map((comment: any) => {
      const profile = comment.profiles || {};
      
      return {
        id: comment.id,
        content: comment.content,
        user_id: comment.user_id,
        post_id: comment.post_id,
        recommendation_id: comment.recommendation_id,
        parent_id: comment.parent_id,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        is_deleted: comment.is_deleted,
        
        // Extract profile data from the joined profile
        username: profile.username || 'Anonymous',
        avatar_url: profile.avatar_url,
        like_count: 0,
        is_liked: false,
        reply_count: 0
      };
    });
    
    // Get comment IDs for further queries
    const commentIds = processedComments.map(comment => comment.id);
    
    if (commentIds.length > 0) {
      // Fetch like counts for all comments
      for (const comment of processedComments) {
        try {
          const { count, error: countError } = await supabase
            .from('comment_likes')
            .select('*', { count: 'exact', head: true })
            .eq('comment_id', comment.id);
          
          if (!countError && count !== null) {
            comment.like_count = count;
          }
        } catch (err) {
          console.error(`Error fetching likes for comment ${comment.id}:`, err);
        }
      }
      
      // Get user like status if user is logged in
      if (userId) {
        const { data: userLikesData, error: userLikesError } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', userId);
          
        if (!userLikesError && userLikesData) {
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
            const { count, error: countError } = await supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('parent_id', comment.id)
              .eq('is_deleted', false);
              
            if (!countError) {
              comment.reply_count = count || 0;
            }
          } catch (err) {
            console.error(`Error fetching replies for comment ${comment.id}:`, err);
          }
        }
      }
    }
    
    console.log('Returning processed comments:', processedComments.length);
    return { comments: processedComments, totalCount };
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
 * Increment comment count for a post or recommendation
 */
export const incrementCommentCount = async (type: 'post' | 'recommendation', id: string): Promise<void> => {
  try {
    const tableName = type === 'post' ? 'posts' : 'recommendations';
    
    // First, get the current comment count
    const { data, error: fetchError } = await supabase
      .from(tableName)
      .select('comment_count')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching current comment count:`, fetchError);
      throw fetchError;
    }
    
    const currentCount = data?.comment_count || 0;
    
    // Then, update with the incremented value
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ comment_count: currentCount + 1 })
      .eq('id', id);
    
    if (updateError) {
      console.error(`Error updating comment count:`, updateError);
      throw updateError;
    }
  } catch (error) {
    console.error(`Error incrementing comment count:`, error);
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
