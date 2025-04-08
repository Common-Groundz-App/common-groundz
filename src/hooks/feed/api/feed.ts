
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams, CombinedFeedItem } from '../types';
import { fetchRecommendations, processRecommendations } from './recommendations';
import { fetchPosts, processPosts } from './posts';
import { sortItemsByDate } from './utils';

// Fetch for you feed (combines recommendations and posts)
export const fetchForYouFeed = async ({ userId, page, itemsPerPage }: FeedQueryParams) => {
  try {
    console.log(`Fetching for-you feed for user ${userId}, page ${page}`);
    
    // Fetch recommendations
    const { recommendations: recsData } = await fetchRecommendations({ userId, page, itemsPerPage });
    console.log(`Fetched ${recsData?.length || 0} recommendations`);
    
    // Process recommendations with user profiles and metadata
    const processedRecs = await processRecommendations(recsData, userId);
    
    // Fetch posts
    const { posts: postsData } = await fetchPosts({ userId, page, itemsPerPage });
    console.log(`Fetched ${postsData?.length || 0} posts`);
    
    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);
    
    // Combine and sort all feed items
    const allItems: CombinedFeedItem[] = [...processedRecs, ...processedPosts];
    const sortedItems = sortItemsByDate(allItems);
    
    // Pagination calculation
    const hasMore = sortedItems.length >= itemsPerPage;
    
    console.log(`Total feed items: ${sortedItems.length}, hasMore: ${hasMore}`);
    
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
    console.log(`Fetching following feed for user ${userId}, page ${page}`);
    
    // Get user's following list
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
      
    if (followingError) {
      console.error('Error fetching following list:', followingError);
      throw followingError;
    }
    
    // If not following anyone, return empty feed
    if (!followingData || followingData.length === 0) {
      console.log('User is not following anyone, returning empty feed');
      return { items: [], hasMore: false };
    }
    
    const followingIds = followingData.map(f => f.following_id);
    console.log(`User is following ${followingIds.length} users`);
    
    // Fetch recommendations from followed users
    const { recommendations: recsData } = await fetchRecommendations(
      { userId, page, itemsPerPage },
      followingIds
    );
    console.log(`Fetched ${recsData?.length || 0} recommendations from followed users`);
    
    // Process recommendations with user profiles and metadata
    const processedRecs = await processRecommendations(recsData, userId);
    
    // Fetch posts from followed users
    const { posts: postsData } = await fetchPosts(
      { userId, page, itemsPerPage },
      followingIds
    );
    console.log(`Fetched ${postsData?.length || 0} posts from followed users`);
    
    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);
    
    // Combine and sort all feed items
    const allItems: CombinedFeedItem[] = [...processedRecs, ...processedPosts];
    const sortedItems = sortItemsByDate(allItems);
    
    // Pagination calculation
    const hasMore = sortedItems.length >= itemsPerPage;
    
    console.log(`Total following feed items: ${sortedItems.length}, hasMore: ${hasMore}`);
    
    return {
      items: sortedItems,
      hasMore
    };
  } catch (error) {
    console.error('Error fetching following feed:', error);
    throw error;
  }
};
