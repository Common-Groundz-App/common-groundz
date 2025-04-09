
import { supabase } from '@/integrations/supabase/client';
import { 
  Comment, 
  CommentWithUser, 
  CreateCommentParams, 
  UpdateCommentParams, 
  FetchCommentsParams 
} from '@/types/comments';
import { generateUUID } from '@/lib/uuid';

/**
 * Fetch comments for a post or recommendation
 */
export const fetchComments = async (params: FetchCommentsParams): Promise<CommentWithUser[]> => {
  try {
    const { post_id, recommendation_id, parent_id = null, limit = 20, offset = 0 } = params;
    
    // Validate that either post_id or recommendation_id is provided, but not both
    if ((!post_id && !recommendation_id) || (post_id && recommendation_id)) {
      throw new Error('Either post_id OR recommendation_id must be provided, not both or neither');
    }
    
    // Build the query
    let query = supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .eq('is_deleted', false)
      .eq('parent_id', parent_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Add the appropriate filter based on what was provided
    if (post_id) {
      query = query.eq('post_id', post_id);
    } else {
      query = query.eq('recommendation_id', recommendation_id);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }

    // Get the comment IDs for additional queries
    const commentIds = data.map(comment => comment.id);
    
    // Fetch like counts for all comments
    const { data: likeCounts, error: likesError } = await supabase
      .from('comment_likes')
      .select('comment_id, count(*)', { count: 'exact' })
      .in('comment_id', commentIds)
      .group('comment_id');

    if (likesError) {
      console.error('Error fetching comment likes:', likesError);
    }

    // Create a map of comment_id -> like count
    const likeCountMap = new Map();
    if (likeCounts) {
      likeCounts.forEach((row: any) => {
        likeCountMap.set(row.comment_id, parseInt(row.count));
      });
    }

    // Fetch if the current user has liked each comment
    const currentUser = supabase.auth.getUser();
    let userLikes: any[] = [];
    
    if (commentIds.length > 0 && (await currentUser).data.user) {
      const { data: userLikesData, error: userLikesError } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds)
        .eq('user_id', (await currentUser).data.user!.id);
        
      if (userLikesError) {
        console.error('Error fetching user likes:', userLikesError);
      } else {
        userLikes = userLikesData || [];
      }
    }

    // Create a set of comment_ids that the user has liked
    const userLikedCommentIds = new Set(userLikes.map((like: any) => like.comment_id));
    
    // Get reply counts for each comment
    const replyCountsPromises = commentIds.map(commentId => 
      getCommentRepliesCount(commentId)
    );
    
    const replyCounts = await Promise.all(replyCountsPromises);
    const replyCountMap = new Map();
    
    commentIds.forEach((commentId, index) => {
      replyCountMap.set(commentId, replyCounts[index]);
    });
    
    // Format the comments with additional data
    const formattedComments = data.map(comment => {
      const profile = comment.profiles || {};
      return {
        ...comment,
        profiles: undefined, // Remove the nested profiles object
        username: profile.username,
        avatar_url: profile.avatar_url,
        likes_count: likeCountMap.get(comment.id) || 0,
        is_liked: userLikedCommentIds.has(comment.id),
        replies_count: replyCountMap.get(comment.id) || 0
      };
    });
    
    return formattedComments as CommentWithUser[];
    
  } catch (error) {
    console.error('Error in fetchComments:', error);
    throw error;
  }
};

/**
 * Get the number of replies for a comment
 */
export const getCommentRepliesCount = async (commentId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .rpc('get_comment_replies_count', { comment_id: commentId });
    
    if (error) {
      console.error('Error fetching comment replies count:', error);
      return 0;
    }
    
    return data || 0;
  } catch (error) {
    console.error('Error in getCommentRepliesCount:', error);
    return 0;
  }
};

/**
 * Create a new comment
 */
export const createComment = async (params: CreateCommentParams): Promise<Comment> => {
  try {
    const { content, post_id, recommendation_id, parent_id } = params;
    
    // Validate that either post_id or recommendation_id is provided, but not both
    if ((!post_id && !recommendation_id) || (post_id && recommendation_id)) {
      throw new Error('Either post_id OR recommendation_id must be provided, not both or neither');
    }
    
    // We'll use optimistic updates, so generate our own UUID
    const newId = generateUUID();
    const user = await supabase.auth.getUser();
    
    if (!user.data.user) {
      throw new Error('User not authenticated');
    }
    
    const newComment = {
      id: newId,
      content,
      user_id: user.data.user.id,
      post_id: post_id || null,
      recommendation_id: recommendation_id || null,
      parent_id: parent_id || null,
      is_deleted: false
    };
    
    const { data, error } = await supabase
      .from('comments')
      .insert(newComment)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in createComment:', error);
    throw error;
  }
};

/**
 * Update an existing comment
 */
export const updateComment = async (params: UpdateCommentParams): Promise<Comment> => {
  try {
    const { id, content } = params;
    
    const { data, error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in updateComment:', error);
    throw error;
  }
};

/**
 * Delete a comment (soft delete)
 */
export const deleteComment = async (commentId: string): Promise<Comment> => {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', commentId)
      .select()
      .single();
    
    if (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in deleteComment:', error);
    throw error;
  }
};

/**
 * Like a comment
 */
export const likeComment = async (commentId: string): Promise<void> => {
  try {
    const user = await supabase.auth.getUser();
    
    if (!user.data.user) {
      throw new Error('User not authenticated');
    }
    
    const { error } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        user_id: user.data.user.id
      });
    
    if (error) {
      // Check if it's a unique constraint violation (user already liked the comment)
      if (error.code === '23505') {
        console.log('User already liked this comment');
        return;
      }
      
      console.error('Error liking comment:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in likeComment:', error);
    throw error;
  }
};

/**
 * Unlike a comment
 */
export const unlikeComment = async (commentId: string): Promise<void> => {
  try {
    const user = await supabase.auth.getUser();
    
    if (!user.data.user) {
      throw new Error('User not authenticated');
    }
    
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.data.user.id);
    
    if (error) {
      console.error('Error unliking comment:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in unlikeComment:', error);
    throw error;
  }
};
