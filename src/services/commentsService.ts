
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
    
    // Use custom query to get comments with user profile data
    const { data, error } = await supabase
      .from(tableName)
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .eq(idField, itemId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Format the response
    return (data || []).map(comment => ({
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      user_id: comment.user_id,
      username: comment.profiles?.username || 'Unknown user',
      avatar_url: comment.profiles?.avatar_url
    }));
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
    const tableName = itemType === 'recommendation' ? 'recommendation_comments' : 'post_comments';
    const idField = itemType === 'recommendation' ? 'recommendation_id' : 'post_id';
    const parentTable = itemType === 'recommendation' ? 'recommendations' : 'posts';
    
    // Insert the comment
    const { error: insertError } = await supabase
      .from(tableName)
      .insert({
        [idField]: itemId,
        user_id: userId,
        content: content.trim()
      });

    if (insertError) throw insertError;

    // Update the comment count in parent table
    const { error: updateError } = await supabase
      .from(parentTable)
      .update({ 
        comment_count: supabase.rpc('get_comment_count', { 
          p_id: itemId, 
          p_table: parentTable 
        }) 
      })
      .eq('id', itemId);

    if (updateError) throw updateError;
    
    return true;
  } catch (error) {
    console.error(`Error adding comment to ${itemType}:`, error);
    return false;
  }
};
