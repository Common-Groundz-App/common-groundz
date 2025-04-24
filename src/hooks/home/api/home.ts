
import { supabase } from '@/integrations/supabase/client';
import { HomeQueryParams, CombinedHomeItem } from '../types';
import { fetchRecommendations, processRecommendations } from './recommendations';
import { fetchPosts, processPosts } from './posts';
import { sortItemsByDate } from './utils';

// Fetch for you home (combines recommendations and posts)
export const fetchForYouHome = async ({ userId, page, itemsPerPage }: HomeQueryParams) => {
  try {
    // Fetch recommendations
    const { recommendations: recsData } = await fetchRecommendations({ userId, page, itemsPerPage });
    
    // Process recommendations with user profiles and metadata
    const processedRecs = await processRecommendations(recsData, userId);
    
    // Fetch posts
    const { posts: postsData } = await fetchPosts({ userId, page, itemsPerPage });
    
    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);
    
    // Combine and sort all home items
    const allItems: CombinedHomeItem[] = [...processedRecs, ...processedPosts];
    const sortedItems = sortItemsByDate(allItems);
    
    // Pagination calculation
    const hasMore = sortedItems.length >= itemsPerPage;
    
    return {
      items: sortedItems,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching for you home:', error);
    throw error;
  }
};

// Fetch following home (posts and recommendations from followed users)
export const fetchFollowingHome = async ({ userId, page, itemsPerPage }: HomeQueryParams) => {
  try {
    // Get user's following list
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
      
    if (followingError) throw followingError;
    
    // If not following anyone, return empty home
    if (!followingData || followingData.length === 0) {
      return { items: [], hasMore: false };
    }
    
    const followingIds = followingData.map(f => f.following_id);
    
    // Fetch recommendations from followed users
    const { recommendations: recsData } = await fetchRecommendations(
      { userId, page, itemsPerPage },
      followingIds
    );
    
    // Process recommendations with user profiles and metadata
    const processedRecs = await processRecommendations(recsData, userId);
    
    // Fetch posts from followed users
    const { posts: postsData } = await fetchPosts(
      { userId, page, itemsPerPage },
      followingIds
    );
    
    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);
    
    // Combine and sort all home items
    const allItems: CombinedHomeItem[] = [...processedRecs, ...processedPosts];
    const sortedItems = sortItemsByDate(allItems);
    
    // Pagination calculation
    const hasMore = sortedItems.length >= itemsPerPage;
    
    return {
      items: sortedItems,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching following home:', error);
    throw error;
  }
};
