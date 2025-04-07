
import { supabase } from '@/integrations/supabase/client';
import { Comment, CreateCommentParams, FetchCommentsParams } from './types';

// Type definition for the execute_sql response
type SqlQueryResponse = {
  data: any[] | null;
  error: Error | null;
}

// Fetch comments for a post or recommendation
export const fetchComments = async (params: FetchCommentsParams): Promise<Comment[]> => {
  try {
    const { target, parent_id } = params;
    
    // Using raw SQL query to avoid issues with the 'comments' table not being in TypeScript definitions
    let queryStr = `
      SELECT c.*, p.username, p.avatar_url
      FROM comments c
      LEFT JOIN profiles p ON c.user_id = p.id
      WHERE c.is_deleted = false
    `;
    
    const values: any[] = [];
    let valueIndex = 1;
    
    // Filter by parent_id (for top-level comments or replies)
    if (parent_id === null) {
      queryStr += ` AND c.parent_id IS NULL`;
    } else if (parent_id) {
      queryStr += ` AND c.parent_id = $${valueIndex}`;
      values.push(parent_id);
      valueIndex++;
    }
    
    // Filter by target (post or recommendation)
    if (target.type === 'post') {
      queryStr += ` AND c.post_id = $${valueIndex} AND c.recommendation_id IS NULL`;
      values.push(target.id);
    } else {
      queryStr += ` AND c.recommendation_id = $${valueIndex} AND c.post_id IS NULL`;
      values.push(target.id);
    }
    
    queryStr += ` ORDER BY c.created_at DESC`;
    
    const { data: response, error }: SqlQueryResponse = await supabase.functions.invoke('execute_sql', {
      body: {
        query_text: queryStr,
        query_params: values
      }
    });
    
    if (error) throw error;
    if (!response || response.length === 0) return [];
    
    // Count replies for each parent comment if we're fetching top-level comments
    const repliesCount: Record<string, number> = {};
    
    if (parent_id === null) {
      const countQuery = `
        SELECT parent_id, COUNT(*) as count
        FROM comments
        WHERE parent_id IN (${response.map((c: any) => `'${c.id}'`).join(',')})
        AND is_deleted = false
        GROUP BY parent_id
      `;
      
      const { data: countsResponse, error: countError }: SqlQueryResponse = await supabase.functions.invoke('execute_sql', {
        body: {
          query_text: countQuery,
          query_params: []
        }
      });
      
      if (!countError && countsResponse) {
        countsResponse.forEach((item: any) => {
          repliesCount[item.parent_id] = parseInt(item.count, 10);
        });
      }
    }
    
    // Enhance comments with profile data and replies count
    return response.map((comment: any) => ({
      ...comment,
      replies_count: repliesCount[comment.id] || 0
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
    
    // Insert comment using raw SQL to avoid type issues
    const insertQuery = `
      INSERT INTO comments (content, user_id, parent_id, post_id, recommendation_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const { data: response, error }: SqlQueryResponse = await supabase.functions.invoke('execute_sql', {
      body: {
        query_text: insertQuery,
        query_params: [
          content,
          user.id,
          parent_id || null,
          target.type === 'post' ? target.id : null,
          target.type === 'recommendation' ? target.id : null
        ]
      }
    });
    
    if (error) throw error;
    if (!response || response.length === 0) throw new Error('Failed to create comment');
    
    // Get user profile for the comment
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }
    
    const newComment = {
      ...response[0],
      username: profileData?.username || null,
      avatar_url: profileData?.avatar_url || null,
      replies_count: 0,
      is_own_comment: true
    };
    
    return newComment as Comment;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
};

// Update a comment
export const updateComment = async (id: string, content: string): Promise<void> => {
  try {
    // Use raw SQL to update
    const updateQuery = `
      UPDATE comments
      SET content = $1
      WHERE id = $2
    `;
    
    const { error }: SqlQueryResponse = await supabase.functions.invoke('execute_sql', {
      body: {
        query_text: updateQuery,
        query_params: [content, id]
      }
    });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

// Delete a comment (soft delete)
export const deleteComment = async (id: string): Promise<void> => {
  try {
    // Use raw SQL to delete
    const deleteQuery = `
      UPDATE comments
      SET is_deleted = true
      WHERE id = $1
    `;
    
    const { error }: SqlQueryResponse = await supabase.functions.invoke('execute_sql', {
      body: {
        query_text: deleteQuery,
        query_params: [id]
      }
    });
      
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};
