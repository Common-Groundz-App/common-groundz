
import { supabase } from '@/integrations/supabase/client';

export interface NewContentCheckResult {
  hasNewContent: boolean;
  newItemCount: number;
  lastCheckTime: number;
}

// Check for new content since last check
export const checkForNewContent = async (
  feedType: 'for_you' | 'following',
  userId: string,
  lastCheckTime: number
): Promise<NewContentCheckResult> => {
  try {
    if (feedType === 'following') {
      // Get user's following list first
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
        
      if (followingError) throw followingError;
      
      if (!followingData || followingData.length === 0) {
        return { hasNewContent: false, newItemCount: 0, lastCheckTime: Date.now() };
      }
    }

    const lastCheckISO = new Date(lastCheckTime).toISOString();
    
    // Check for new recommendations
    let recsQuery = supabase
      .from('recommendations')
      .select('id, created_at')
      .eq('visibility', 'public')
      .gt('created_at', lastCheckISO)
      .order('created_at', { ascending: false });
    
    // Check for new posts
    let postsQuery = supabase
      .from('posts')
      .select('id, created_at')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .gt('created_at', lastCheckISO)
      .order('created_at', { ascending: false });

    if (feedType === 'following') {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
      
      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id);
        recsQuery = recsQuery.in('user_id', followingIds);
        postsQuery = postsQuery.in('user_id', followingIds);
      }
    }

    const [{ data: newRecs }, { data: newPosts }] = await Promise.all([
      recsQuery,
      postsQuery
    ]);

    const newRecsCount = newRecs?.length || 0;
    const newPostsCount = newPosts?.length || 0;
    const totalNewCount = newRecsCount + newPostsCount;

    return {
      hasNewContent: totalNewCount > 0,
      newItemCount: totalNewCount,
      lastCheckTime: Date.now()
    };
  } catch (error) {
    console.error('Error checking for new content:', error);
    return { hasNewContent: false, newItemCount: 0, lastCheckTime: Date.now() };
  }
};

// Get the last refresh timestamp from localStorage
export const getLastRefreshTime = (feedType: string, userId: string): number => {
  const key = `lastRefresh_${feedType}_${userId}`;
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored) : Date.now() - (5 * 60 * 1000); // Default to 5 minutes ago
};

// Set the last refresh timestamp in localStorage
export const setLastRefreshTime = (feedType: string, userId: string, timestamp: number = Date.now()): void => {
  const key = `lastRefresh_${feedType}_${userId}`;
  localStorage.setItem(key, timestamp.toString());
};
