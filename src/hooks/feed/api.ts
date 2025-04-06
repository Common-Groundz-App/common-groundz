
import { supabase } from '@/integrations/supabase/client';
import { FeedItem, FeedQueryParams, PostFeedItem, CombinedFeedItem } from './types';

const ITEMS_PER_PAGE = 10;

export async function fetchForYouFeed({ userId, page, itemsPerPage = ITEMS_PER_PAGE }: FeedQueryParams) {
  const offset = page * itemsPerPage;
  
  // Fetch recommendations
  const { data: recommendationsData, error: recommendationsError } = await supabase
    .from('recommendations')
    .select(`
      id, 
      title, 
      venue, 
      description, 
      rating, 
      image_url, 
      category, 
      visibility, 
      is_certified, 
      view_count, 
      user_id, 
      created_at, 
      updated_at,
      entities!entity_id (id, name, type, venue, description, image_url)
    `)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + itemsPerPage - 1);
    
  if (recommendationsError) throw recommendationsError;
  
  // Fetch posts
  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      content,
      post_type,
      visibility,
      user_id,
      created_at,
      updated_at
    `)
    .eq('visibility', 'public')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + itemsPerPage - 1);
    
  if (postsError) throw postsError;
  
  // Enrich recommendations with user interaction data and profile info
  const enrichedRecommendations = await enrichRecommendationsData(recommendationsData || [], userId);
  
  // Enrich posts with user profile information
  const enrichedPosts = await enrichPostsData(postsData || [], userId);
  
  // Combine and sort by created_at
  const combinedItems = [
    ...enrichedRecommendations.items,
    ...enrichedPosts
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Take only itemsPerPage items
  const finalItems = combinedItems.slice(0, itemsPerPage);
  
  return { 
    items: finalItems, 
    hasMore: combinedItems.length >= itemsPerPage 
  };
}

export async function fetchFollowingFeed({ userId, page, itemsPerPage = ITEMS_PER_PAGE }: FeedQueryParams) {
  const offset = page * itemsPerPage;
  
  // Get users the current user follows
  const { data: followingIds, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
    
  if (followsError) throw followsError;
  
  const followingUserIds = followingIds?.map(follow => follow.following_id) || [];
  
  // If user isn't following anyone, return empty array
  if (followingUserIds.length === 0) {
    return { items: [], hasMore: false };
  }
  
  // Fetch recommendations from followed users
  const { data: recommendationsData, error: recommendationsError } = await supabase
    .from('recommendations')
    .select(`
      id, 
      title, 
      venue, 
      description, 
      rating, 
      image_url, 
      category, 
      visibility, 
      is_certified, 
      view_count, 
      user_id, 
      created_at, 
      updated_at,
      entities!entity_id (id, name, type, venue, description, image_url)
    `)
    .in('user_id', followingUserIds)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + itemsPerPage - 1);
    
  if (recommendationsError) throw recommendationsError;
  
  // Fetch posts from followed users
  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      content,
      post_type,
      visibility,
      user_id,
      created_at,
      updated_at
    `)
    .in('user_id', followingUserIds)
    .eq('visibility', 'public')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + itemsPerPage - 1);
    
  if (postsError) throw postsError;
  
  // Enrich recommendations with user interaction data
  const enrichedRecommendations = await enrichRecommendationsData(recommendationsData || [], userId);
  
  // Enrich posts with user profile information
  const enrichedPosts = await enrichPostsData(postsData || [], userId);
  
  // Combine and sort by created_at
  const combinedItems = [
    ...enrichedRecommendations.items,
    ...enrichedPosts
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Take only itemsPerPage items
  const finalItems = combinedItems.slice(0, itemsPerPage);
  
  return { 
    items: finalItems, 
    hasMore: combinedItems.length >= itemsPerPage 
  };
}

async function enrichRecommendationsData(data: any[], userId: string) {
  if (!data.length) {
    return { items: [], hasMore: false };
  }
  
  // Get recommendation IDs
  const recommendationIds = data.map(item => item.id);
  
  // Get likes for the current user
  const { data: userLikes } = await supabase
    .from('recommendation_likes')
    .select('recommendation_id')
    .eq('user_id', userId)
    .in('recommendation_id', recommendationIds);
    
  // Get saves for the current user
  const { data: userSaves } = await supabase
    .from('recommendation_saves')
    .select('recommendation_id')
    .eq('user_id', userId)
    .in('recommendation_id', recommendationIds);
    
  // Fetch all likes and count them
  const { data: allLikes } = await supabase
    .from('recommendation_likes')
    .select('recommendation_id')
    .in('recommendation_id', recommendationIds);
    
  // Count likes for each recommendation
  const likesCount: Record<string, number> = {};
  allLikes?.forEach(like => {
    if (like.recommendation_id) {
      likesCount[like.recommendation_id] = (likesCount[like.recommendation_id] || 0) + 1;
    }
  });
  
  // Fetch user profiles
  const userIds = Array.from(new Set(data.map(item => item.user_id as string)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
  
  // Create profile lookup map
  const profilesMap: Record<string, { username: string | null, avatar_url: string | null }> = {};
  profiles?.forEach(profile => {
    profilesMap[profile.id] = {
      username: profile.username,
      avatar_url: profile.avatar_url
    };
  });
  
  // Map the data to FeedItem format
  const items = data.map(item => {
    const likes = likesCount[item.id] || 0;
    const is_liked = userLikes?.some(like => like.recommendation_id === item.id) || false;
    const is_saved = userSaves?.some(save => save.recommendation_id === item.id) || false;
    const profile = profilesMap[item.user_id] || { username: null, avatar_url: null };
    
    return {
      ...item,
      likes,
      is_liked,
      is_saved,
      username: profile.username,
      avatar_url: profile.avatar_url,
      entity: item.entities,
      is_post: false
    } as FeedItem;
  });
  
  return { items, hasMore: items.length === ITEMS_PER_PAGE };
}

async function enrichPostsData(posts: any[], userId: string): Promise<PostFeedItem[]> {
  if (!posts.length) {
    return [];
  }
  
  // Fetch user profiles
  const userIds = Array.from(new Set(posts.map(post => post.user_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds);
  
  // Create profile lookup map
  const profilesMap: Record<string, { username: string | null, avatar_url: string | null }> = {};
  profiles?.forEach(profile => {
    profilesMap[profile.id] = {
      username: profile.username,
      avatar_url: profile.avatar_url
    };
  });
  
  // Fetch entities for each post - using our custom function
  const postIds = posts.map(post => post.id);
  const { data: entitiesData } = await supabase.rpc('get_post_entities', { post_ids: postIds });
  
  // Group entities by post ID
  const entitiesByPostId: Record<string, any[]> = {};
  if (entitiesData) {
    (entitiesData as any[]).forEach(item => {
      if (!entitiesByPostId[item.post_id]) {
        entitiesByPostId[item.post_id] = [];
      }
      entitiesByPostId[item.post_id].push(item.entity);
    });
  }
  
  // Map the posts data
  return posts.map(post => {
    const profile = profilesMap[post.user_id] || { username: null, avatar_url: null };
    
    return {
      ...post,
      username: profile.username,
      avatar_url: profile.avatar_url,
      is_post: true,
      // Initialize the properties required by CombinedFeedItem
      likes: 0,
      is_liked: false,
      is_saved: false,
      // Add tagged entities
      tagged_entities: entitiesByPostId[post.id] || []
    } as PostFeedItem;
  });
}
