
import { HomeQueryParams } from '../types';
import { fetchPosts, processPosts } from './posts';
import { fetchProfiles } from './profiles';
import { supabase } from '@/integrations/supabase/client';

const ITEMS_PER_PAGE = 10;

// Fetch For You feed content
export const fetchForYouHome = async ({ userId, page, itemsPerPage }: HomeQueryParams) => {
  try {
    // Fetch posts for the For You feed
    const { posts, userIds } = await fetchPosts({ userId, page, itemsPerPage });
    
    // Process posts to include like/save status, user info, etc.
    const processedPosts = await processPosts(posts, userId);
    
    return {
      items: processedPosts,
      hasMore: processedPosts.length >= itemsPerPage
    };
  } catch (error) {
    console.error('Error fetching For You home feed:', error);
    throw error;
  }
};

// Fetch Following feed content (from users the current user follows)
export const fetchFollowingHome = async ({ userId, page, itemsPerPage }: HomeQueryParams) => {
  try {
    // Get IDs of users the current user follows
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
    
    if (followingError) throw followingError;
    
    const followingIds = followingData.map(item => item.following_id);
    
    // If user doesn't follow anyone, return empty results
    if (followingIds.length === 0) {
      return { items: [], hasMore: false };
    }
    
    // Fetch posts from followed users
    const { posts } = await fetchPosts({ userId, page, itemsPerPage }, followingIds);
    
    // Process posts to include like/save status, user info, etc.
    const processedPosts = await processPosts(posts, userId);
    
    return {
      items: processedPosts,
      hasMore: processedPosts.length >= itemsPerPage
    };
  } catch (error) {
    console.error('Error fetching Following home feed:', error);
    throw error;
  }
};
