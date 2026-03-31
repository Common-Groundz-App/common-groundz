
import { supabase } from '@/integrations/supabase/client';

export interface CommentData {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  displayName?: string;
  first_name?: string;
  last_name?: string;
  edited_at?: string;
  parent_id?: string | null;
  like_count?: number;
  reply_count?: number;
  is_liked?: boolean;
  is_from_circle?: boolean;
}

export const fetchComments = async (itemId: string, itemType: 'recommendation' | 'post', currentUserId?: string | null): Promise<CommentData[]> => {
  try {
    const tableName = itemType === 'recommendation' ? 'recommendation_comments' : 'post_comments';
    const idField = itemType === 'recommendation' ? 'recommendation_id' : 'post_id';
    
    const rpcParams: any = { 
      p_table_name: tableName, 
      p_id_field: idField, 
      p_item_id: itemId 
    };
    
    if (currentUserId) {
      rpcParams.p_current_user_id = currentUserId;
    }
    
    const { data, error } = await (supabase.rpc as any)('get_comments_with_profiles', rpcParams);

    if (error) throw error;

    return Array.isArray(data) ? data.map(comment => {
      const displayName = [comment.first_name, comment.last_name].filter(Boolean).join(' ') || comment.username || 'Unknown user';
      return {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user_id: comment.user_id,
        username: comment.username || 'Unknown user',
        avatar_url: comment.avatar_url,
        displayName,
        first_name: comment.first_name,
        last_name: comment.last_name,
        edited_at: comment.edited_at,
        parent_id: comment.parent_id || null,
        like_count: comment.like_count || 0,
        reply_count: comment.reply_count || 0,
        is_liked: comment.is_liked || false,
        is_from_circle: comment.is_from_circle || false,
      };
    }) : [];
  } catch (error) {
    console.error(`Error fetching ${itemType} comments:`, error);
    return [];
  }
};

export const fetchCommentCount = async (itemId: string, itemType: 'recommendation' | 'post') => {
  try {
    const tableName = itemType === 'recommendation' ? 'recommendations' : 'posts';
    const { data, error } = await supabase
      .from(tableName)
      .select('comment_count')
      .eq('id', itemId)
      .single();

    if (error) throw error;
    return data?.comment_count || 0;
  } catch (error) {
    console.error(`Error fetching comment count for ${itemType}:`, error);
    return 0;
  }
};

export const addComment = async (itemId: string, itemType: 'recommendation' | 'post', content: string, userId: string, parentId?: string | null): Promise<boolean> => {
  try {
    const rpcParams: any = { 
      p_item_id: itemId, 
      p_item_type: itemType, 
      p_content: content.trim(),
      p_user_id: userId 
    };
    
    if (parentId) {
      rpcParams.p_parent_id = parentId;
    }
    
    const { error } = await (supabase.rpc as any)('add_comment', rpcParams);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error adding comment to ${itemType}:`, error);
    return false;
  }
};

export const deleteComment = async (commentId: string, itemType: 'recommendation' | 'post', userId: string): Promise<boolean> => {
  try {
    console.log(`Starting deleteComment with: commentId=${commentId}, itemType=${itemType}, userId=${userId}`);
    
    if (!commentId || !itemType || !userId) {
      console.error('Missing required parameters for deleteComment', { commentId, itemType, userId });
      return false;
    }
    
    const { data, error } = await (supabase.rpc as any)('delete_comment', {
      p_comment_id: commentId,
      p_item_type: itemType,
      p_user_id: userId
    });

    if (error) {
      console.error('Supabase error deleting comment:', error);
      throw error;
    }
    
    console.log('Delete comment response:', data);
    return data === true;
  } catch (error) {
    console.error(`Error deleting comment from ${itemType}:`, error);
    return false;
  }
};

export const updateComment = async (commentId: string, content: string, itemType: 'recommendation' | 'post', userId: string): Promise<boolean> => {
  try {
    const { data, error } = await (supabase.rpc as any)('update_comment', {
      p_comment_id: commentId,
      p_content: content.trim(),
      p_user_id: userId,
      p_item_type: itemType
    });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    if (data === true) {
      return true;
    } else {
      console.warn('Update operation returned false or null:', data);
      return false;
    }
  } catch (error) {
    console.error(`Error updating comment for ${itemType}:`, error);
    return false;
  }
};

export const toggleCommentLike = async (commentId: string, commentType: 'post' | 'recommendation', userId: string): Promise<boolean | null> => {
  try {
    const { data, error } = await (supabase.rpc as any)('toggle_comment_like', {
      p_comment_id: commentId,
      p_comment_type: commentType,
      p_user_id: userId
    });

    if (error) {
      console.error('Error toggling comment like:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Error toggling comment like:`, error);
    return null;
  }
};
