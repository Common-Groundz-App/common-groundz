
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams } from '../../types';

// Fetch posts with pagination
export const fetchPosts = async (
  { page, itemsPerPage }: FeedQueryParams,
  followingIds?: string[] // Optional parameter to filter by following users
) => {
  try {
    const postsFrom = page * itemsPerPage;
    const postsTo = postsFrom + itemsPerPage - 1;
    
    let query = supabase
      .from('posts')
      .select(`*`)
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

// Fetch post entities for a list of post IDs
export const fetchPostEntities = async (postIds: string[]) => {
  if (!postIds.length) return {};
  
  try {
    // Use direct query instead of RPC function to avoid type issues
    const { data: entityData, error: entityError } = await supabase
      .from('post_entities')
      .select('post_id, entity_id, entities:entity_id(*)')
      .in('post_id', postIds);
      
    if (entityError) {
      console.error('Error fetching post entities:', entityError);
      return {};
    }
    
    // Group entities by post_id
    const entitiesByPostId: Record<string, any[]> = {};
    
    if (entityData) {
      entityData.forEach((item: any) => {
        if (!entitiesByPostId[item.post_id]) {
          entitiesByPostId[item.post_id] = [];
        }
        if (item.entities) {
          entitiesByPostId[item.post_id].push(item.entities);
        }
      });
    }
    
    return entitiesByPostId;
  } catch (error) {
    console.error('Error fetching post entities:', error);
    return {};
  }
};
