
import { supabase } from '@/integrations/supabase/client';

export interface CommentData {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
}

export const fetchComments = async (itemId: string, itemType: 'recommendation' | 'post'): Promise<CommentData[]> => {
  try {
    const tableName = itemType === 'recommendation' ? 'recommendation_comments' : 'post_comments';
    const idField = itemType === 'recommendation' ? 'recommendation_id' : 'post_id';
    
    const { data, error } = await (supabase
      .rpc as any)('get_comments_with_profiles', { 
        p_table_name: tableName, 
        p_id_field: idField, 
        p_item_id: itemId 
      });

    if (error) throw error;

    return Array.isArray(data) ? data.map(comment => ({
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      user_id: comment.user_id,
      username: comment.username || 'Unknown user',
      avatar_url: comment.avatar_url
    })) : [];
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

export const addComment = async (itemId: string, itemType: 'recommendation' | 'post', content: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await (supabase.rpc as any)('add_comment', { 
      p_item_id: itemId, 
      p_item_type: itemType, 
      p_content: content.trim(),
      p_user_id: userId 
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error adding comment to ${itemType}:`, error);
    return false;
  }
};

export const deleteComment = async (commentId: string, itemType: 'recommendation' | 'post', userId: string): Promise<boolean> => {
  try {
    console.log(`Calling delete_comment with: commentId=${commentId}, itemType=${itemType}, userId=${userId}`);
    
    // Add delay to ensure the call completes properly
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Use type assertion to bypass TypeScript's type checking for RPC functions
    const { data, error } = await (supabase.rpc as any)('delete_comment', {
      p_comment_id: commentId,
      p_item_type: itemType,
      p_user_id: userId
    });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Delete comment response:', data);
    
    // Add a small delay after the call completes to ensure state updates properly
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (data === true) {
      return true;
    } else {
      console.warn('Delete operation returned false or null:', data);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting comment from ${itemType}:`, error);
    return false;
  }
};

export const updateComment = async (commentId: string, content: string, itemType: 'recommendation' | 'post', userId: string): Promise<boolean> => {
  try {
    console.log(`Calling update_comment with: commentId=${commentId}, content=${content}, itemType=${itemType}, userId=${userId}`);
    
    // Use type assertion to bypass TypeScript's type checking for RPC functions
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
    
    console.log('Update comment response:', data);
    
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
