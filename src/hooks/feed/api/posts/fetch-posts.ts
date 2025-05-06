
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams } from '../../types';
import { PostsQueryResult } from './types';

// Fetch posts with pagination
export const fetchPosts = async (
  { page, itemsPerPage }: FeedQueryParams,
  followingIds?: string[] // Optional parameter to filter by following users
): Promise<PostsQueryResult> => {
  try {
    const postsFrom = page * itemsPerPage;
    const postsTo = postsFrom + itemsPerPage - 1;
    
    let query = supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        post_type,
        visibility,
        user_id,
        created_at,
        updated_at,
        media,
        view_count,
        status,
        is_deleted,
        tags
      `)
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(postsFrom, postsTo);
      
    // Filter by following users if provided
    if (followingIds && followingIds.length > 0) {
      query = query.in('user_id', followingIds);
    }
    
    const { data: postsData, error: postsError } = await query;
      
    if (postsError) throw postsError;
    if (!postsData || postsData.length === 0) return { posts: [], userIds: [] };
    
    // Extract user IDs for profile fetching
    const userIds = postsData.map(post => post.user_id);
    
    return { posts: postsData, userIds };
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};
