
import { supabase } from '@/integrations/supabase/client';
import { Comment, CommentInput, CommentListParams } from '@/types/comment';

/**
 * Fetch comments with associated profile data and like information
 */
export async function fetchComments(
  params: CommentListParams,
  currentUserId?: string
): Promise<{ comments: Comment[], total: number }> {
  try {
    const { post_id, recommendation_id, parent_id, limit = 10, offset = 0 } = params;
    
    // Base query with join to profiles
    let query = supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('is_deleted', false);
    
    // Apply filters
    if (post_id) {
      query = query.eq('post_id', post_id);
    }
    
    if (recommendation_id) {
      query = query.eq('recommendation_id', recommendation_id);
    }
    
    // Handle parent_id filter (null for top-level, specific ID for replies)
    if (parent_id === null) {
      query = query.is('parent_id', null);
    } else if (parent_id) {
      query = query.eq('parent_id', parent_id);
    }
    
    // Order and paginate
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Execute query
    const { data: commentsData, error, count } = await query;
    
    if (error) throw error;
    
    const processedComments: Comment[] = commentsData?.map((comment: any) => {
      return {
        ...comment,
        username: comment.profiles?.username,
        avatar_url: comment.profiles?.avatar_url,
        like_count: 0,
        is_liked: false,
        reply_count: 0
      };
    }) || [];
    
    // If we have comments, fetch additional data
    if (processedComments.length > 0) {
      const commentIds = processedComments.map(c => c.id);
      
      // Fetch like counts
      for (const comment of processedComments) {
        const { count } = await supabase
          .from('comment_likes')
          .select('*', { count: 'exact', head: true })
          .eq('comment_id', comment.id);
          
        comment.like_count = count || 0;
      }
      
      // Check if current user liked comments
      if (currentUserId) {
        const { data: userLikes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', currentUserId)
          .in('comment_id', commentIds);
          
        if (userLikes) {
          userLikes.forEach((like: any) => {
            const comment = processedComments.find(c => c.id === like.comment_id);
            if (comment) comment.is_liked = true;
          });
        }
      }
      
      // Get reply counts for top-level comments
      if (parent_id === null) {
        for (const comment of processedComments) {
          const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', comment.id)
            .eq('is_deleted', false);
            
          comment.reply_count = count || 0;
        }
      }
    }
    
    return { 
      comments: processedComments,
      total: count || 0
    };
    
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
}

/**
 * Create a new comment
 */
export async function createComment(
  input: CommentInput
): Promise<Comment> {
  try {
    // Ensure user_id is required in the CommentInput type
    const { data, error } = await supabase
      .from('comments')
      .insert({
        content: input.content,
        post_id: input.post_id || null,
        recommendation_id: input.recommendation_id || null,
        parent_id: input.parent_id || null,
        user_id: input.user_id // This is now required in the CommentInput type
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // Increment comment count on post or recommendation
    if (input.post_id && !input.parent_id) {
      await incrementCommentCount('posts', input.post_id);
    } else if (input.recommendation_id && !input.parent_id) {
      await incrementCommentCount('recommendations', input.recommendation_id);
    }
    
    return data;
    
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
}

/**
 * Increment comment count on post or recommendation
 */
export async function incrementCommentCount(
  tableName: 'posts' | 'recommendations',
  id: string
): Promise<void> {
  try {
    await supabase.rpc('increment_comment_count', { 
      table_name: tableName,
      item_id: id
    });
  } catch (error) {
    console.error('Error incrementing comment count:', error);
    // Non-blocking error - we don't want to fail the comment creation
  }
}

/**
 * Update an existing comment
 */
export async function updateComment(
  id: string,
  content: string
): Promise<Comment> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({ 
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    return data;
    
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
}

/**
 * Delete a comment (soft delete)
 */
export async function deleteComment(id: string): Promise<void> {
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
}

/**
 * Toggle like status on a comment
 */
export async function toggleCommentLike(
  commentId: string,
  userId: string
): Promise<boolean> {
  try {
    // Check if already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (checkError) throw checkError;
    
    // If liked, unlike
    if (existingLike) {
      const { error: deleteError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('id', existingLike.id);
        
      if (deleteError) throw deleteError;
      return false; // Not liked anymore
    } 
    // If not liked, like
    else {
      const { error: insertError } = await supabase
        .from('comment_likes')
        .insert({ 
          comment_id: commentId,
          user_id: userId
        });
        
      if (insertError) throw insertError;
      return true; // Now liked
    }
    
  } catch (error) {
    console.error('Error toggling comment like:', error);
    throw error;
  }
}
