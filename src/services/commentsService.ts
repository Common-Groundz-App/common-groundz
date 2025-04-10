
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
    
    // Use the rpc method but cast it to any to bypass TypeScript issues
    // This is because our types don't yet include the new functions
    const { data, error } = await (supabase
      .rpc as any)('get_comments_with_profiles', { 
        p_table_name: tableName, 
        p_id_field: idField, 
        p_item_id: itemId 
      });

    if (error) throw error;

    // Format the response and ensure data is an array
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
    // Use a custom RPC function to handle comment creation and counter updates
    // Also cast to any to bypass TypeScript issues with new functions
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

export const editComment = async (
  commentId: string, 
  itemType: 'recommendation' | 'post', 
  content: string
): Promise<boolean> => {
  try {
    const tableName = itemType === 'recommendation' ? 'recommendation_comments' : 'post_comments';
    
    const { error } = await supabase
      .from(tableName)
      .update({ content: content.trim() })
      .eq('id', commentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error editing ${itemType} comment:`, error);
    return false;
  }
};

export const deleteComment = async (
  commentId: string,
  itemId: string,
  itemType: 'recommendation' | 'post'
): Promise<boolean> => {
  try {
    const commentTable = itemType === 'recommendation' ? 'recommendation_comments' : 'post_comments';
    const parentTable = itemType === 'recommendation' ? 'recommendations' : 'posts';
    
    // Step 1: Begin a transaction by marking the comment as deleted
    const { error: deleteError } = await supabase
      .from(commentTable)
      .update({ is_deleted: true })
      .eq('id', commentId);
    
    if (deleteError) throw deleteError;
    
    // Step 2: Get the current count
    const { data, error: fetchError } = await supabase
      .from(parentTable)
      .select('comment_count')
      .eq('id', itemId)
      .single();
      
    if (fetchError) throw fetchError;
    
    // Step 3: Update with the decremented count, ensuring it's not negative
    const newCount = Math.max(0, (data?.comment_count || 1) - 1);
    const { error: updateError } = await supabase
      .from(parentTable)
      .update({ comment_count: newCount })
      .eq('id', itemId);
      
    if (updateError) throw updateError;
    
    return true;
  } catch (error) {
    console.error(`Error deleting ${itemType} comment:`, error);
    return false;
  }
};
