
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams, CombinedFeedItem } from '../types';
import { fetchRecommendations, processRecommendations } from './recommendations';
import { fetchPosts, processPosts } from './posts';
import { sortItemsByDate } from './utils';

// Fetch for you feed (combines recommendations and posts)
export const fetchForYouFeed = async ({ userId, page, itemsPerPage }: FeedQueryParams) => {
  try {
    // Fetch recommendations data
    const recsData = await fetchRecommendations({ userId, page, itemsPerPage });
    
    // Fetch posts
    const { posts: postsData } = await fetchPosts({ userId, page, itemsPerPage });
    
    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);
    
    // Combine and sort all feed items
    const allItems: CombinedFeedItem[] = [...recsData, ...processedPosts];
    const sortedItems = sortItemsByDate(allItems);
    
    // Pagination calculation
    const hasMore = sortedItems.length >= itemsPerPage;
    
    return {
      items: sortedItems,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching for you feed:', error);
    throw error;
  }
};

// Fetch following feed (posts and recommendations from followed users)
export const fetchFollowingFeed = async ({ userId, page, itemsPerPage }: FeedQueryParams) => {
  try {
    // Get user's following list
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
      
    if (followingError) throw followingError;
    
    // If not following anyone, return empty feed
    if (!followingData || followingData.length === 0) {
      return { items: [], hasMore: false };
    }
    
    const followingIds = followingData.map(f => f.following_id);
    
    // Fetch recommendations from followed users
    const recsData = await fetchRecommendations({ userId, page, itemsPerPage });
    
    // Fetch posts from followed users
    const { posts: postsData } = await fetchPosts({ userId, page, itemsPerPage });
    
    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);
    
    // Combine and sort all feed items
    const allItems: CombinedFeedItem[] = [...recsData, ...processedPosts];
    const sortedItems = sortItemsByDate(allItems);
    
    // Pagination calculation
    const hasMore = sortedItems.length >= itemsPerPage;
    
    return {
      items: sortedItems,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching following feed:', error);
    throw error;
  }
};
