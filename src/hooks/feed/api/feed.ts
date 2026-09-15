
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams, CombinedFeedItem } from '../types';
import { fetchPosts, processPosts } from './posts';
import { sortItemsByDate } from './utils';

// Fetch for you feed (posts only — the legacy recommendations layer is frozen)
export const fetchForYouFeed = async ({ userId, page, itemsPerPage }: FeedQueryParams) => {
  try {
    // Fetch posts
    const { posts: postsData } = await fetchPosts({ userId, page, itemsPerPage });

    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);

    const allItems: CombinedFeedItem[] = processedPosts;
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

// Fetch following feed (posts from followed users)
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

    // Fetch posts from followed users
    const { posts: postsData } = await fetchPosts({ userId, page, itemsPerPage });

    // Process posts with metadata
    const processedPosts = await processPosts(postsData, userId);

    const allItems: CombinedFeedItem[] = processedPosts;
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
