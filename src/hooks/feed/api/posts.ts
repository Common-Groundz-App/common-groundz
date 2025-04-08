
import { supabase } from '@/integrations/supabase/client';
import { PostFeedItem, FeedQueryParams } from '../types';
import { fetchProfiles } from './profiles';
import { createMap, processMediaItems } from './utils';

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

// Get post like counts for a list of post IDs
export const getPostLikeCounts = async (postIds: string[]) => {
  if (!postIds.length) return new Map<string, number>();
  
  try {
    const { data: postLikesData } = await supabase
      .from('post_likes')
      .select('post_id');
      
    const likeCounts = new Map<string, number>();
    
    if (postLikesData) {
      postLikesData.forEach((item: any) => {
        const count = likeCounts.get(item.post_id) || 0;
        likeCounts.set(item.post_id, count + 1);
      });
    }
    
    return likeCounts;
  } catch (error) {
    console.error('Error counting post likes:', error);
    return new Map<string, number>();
  }
};

// Get user likes for posts
export const getUserPostLikes = async (postIds: string[], userId: string) => {
  if (!postIds.length) return new Set<string>();
  
  try {
    const { data: userLikesData } = await supabase
      .from('post_likes')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', userId);
    
    const userLikedPosts = new Set<string>();
    
    if (userLikesData) {
      userLikesData.forEach((item: any) => {
        userLikedPosts.add(item.post_id);
      });
    }
    
    return userLikedPosts;
  } catch (error) {
    console.error('Error fetching user post likes:', error);
    return new Set<string>();
  }
};

// Get user saves for posts
export const getUserPostSaves = async (postIds: string[], userId: string) => {
  if (!postIds.length) return new Set<string>();
  
  try {
    const { data: userSavesData } = await supabase
      .from('post_saves')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', userId);
    
    const userSavedPosts = new Set<string>();
    
    if (userSavesData) {
      userSavesData.forEach((item: any) => {
        userSavedPosts.add(item.post_id);
      });
    }
    
    return userSavedPosts;
  } catch (error) {
    console.error('Error fetching user post saves:', error);
    return new Set<string>();
  }
};

// Process posts data with additional metadata
export const processPosts = async (
  postsData: any[], 
  userId: string
): Promise<PostFeedItem[]> => {
  if (!postsData.length) return [];
  
  try {
    // Get post IDs for fetching related data
    const postIds = postsData.map(post => post.id);
    
    // Fetch user profiles
    const userIds = postsData.map(post => post.user_id);
    const { data: profilesData } = await fetchProfiles(userIds);
    
    // Create lookup map for profiles
    const profilesMap = createMap(profilesData, 'id');
    
    // Get entities for posts
    const entitiesByPostId = await fetchPostEntities(postIds);
    
    // Get post likes count
    const likeCounts = await getPostLikeCounts(postIds);
    
    // Get user likes and saves for posts
    const userLikedPosts = await getUserPostLikes(postIds, userId);
    const userSavedPosts = await getUserPostSaves(postIds, userId);
    
    // Format the posts as feed items
    const processedPosts = postsData.map(post => {
      // Get profile data
      const profile = profilesMap.get(post.user_id);
      const username = profile?.username || null;
      const avatar_url = profile?.avatar_url || null;
      
      // Process media properly with type safety
      const mediaItems = processMediaItems(post.media || []);
      
      // Get post metadata
      const likes = likeCounts.get(post.id) || 0;
      const isLiked = userLikedPosts.has(post.id);
      const isSaved = userSavedPosts.has(post.id);
      
      // Ensure status is one of the allowed values
      let postStatus: 'draft' | 'published' | 'failed' = 'published';
      if (post.status === 'draft' || post.status === 'failed') {
        postStatus = post.status as 'draft' | 'published' | 'failed';
      }
      
      return {
        ...post,
        username,
        avatar_url,
        is_post: true,
        likes,
        is_liked: isLiked,
        is_saved: isSaved,
        tagged_entities: entitiesByPostId[post.id] || [],
        media: mediaItems,
        status: postStatus
      } as PostFeedItem;
    });
    
    return processedPosts;
  } catch (error) {
    console.error('Error processing posts:', error);
    throw error;
  }
};
