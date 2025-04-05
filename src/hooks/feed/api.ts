
import { supabase } from '@/integrations/supabase/client';
import { FeedItem, FeedQueryParams } from './types';

const ITEMS_PER_PAGE = 10;

export async function fetchForYouFeed({ userId, page, itemsPerPage = ITEMS_PER_PAGE }: FeedQueryParams) {
  const offset = page * itemsPerPage;
  
  // Fetch recommendations
  const { data, error } = await supabase
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
    
  if (error) throw error;
  
  return await enrichRecommendationsData(data || [], userId);
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
  const { data, error } = await supabase
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
    
  if (error) throw error;
  
  return await enrichRecommendationsData(data || [], userId);
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
      entity: item.entities
    } as FeedItem;
  });
  
  return { items, hasMore: items.length === ITEMS_PER_PAGE };
}
