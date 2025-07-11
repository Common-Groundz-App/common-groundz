
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '../types';

/**
 * Fetch followers for a profile user using optimized RPC with batch follow status check
 */
export const fetchFollowers = async (profileUserId: string, currentUserId?: string): Promise<UserProfile[]> => {
  try {
    // Use RPC for efficient query with built-in follow status check
    const { data: followersData, error: followersError } = await supabase
      .rpc('get_followers_with_profiles', {
        profile_user_id: profileUserId,
        current_user_id: currentUserId || null
      });
    
    if (followersError) {
      console.error('Error fetching followers:', followersError);
      return [];
    }
    
    console.log(`Fetched ${followersData?.length || 0} followers for profile ${profileUserId} using optimized RPC`);
    
    // Map the data to ensure property consistency
    const mappedData = followersData?.map(follower => ({
      id: follower.id,
      username: follower.username,
      avatar_url: follower.avatar_url,
      isFollowing: follower.is_following
    })) || [];
    
    console.log('Processed followers data with optimized query:', mappedData.length);
    return mappedData;
  } catch (error) {
    console.error('Error in fetchFollowers:', error);
    return [];
  }
};

/**
 * Fetch following for a profile user using optimized RPC with batch follow status check
 */
export const fetchFollowing = async (profileUserId: string, currentUserId?: string): Promise<UserProfile[]> => {
  try {
    // Use RPC for efficient query with built-in follow status check
    const { data: followingData, error: followingError } = await supabase
      .rpc('get_following_with_profiles', {
        profile_user_id: profileUserId,
        current_user_id: currentUserId || null
      });
    
    if (followingError) {
      console.error('Error fetching following:', followingError);
      return [];
    }
    
    console.log(`Fetched ${followingData?.length || 0} following for profile ${profileUserId} using optimized RPC`);
    
    // Map the data to ensure property consistency
    const mappedData = followingData?.map(following => ({
      id: following.id,
      username: following.username,
      avatar_url: following.avatar_url,
      isFollowing: following.is_following
    })) || [];
    
    console.log('Processed following data with optimized query:', mappedData.length);
    return mappedData;
  } catch (error) {
    console.error('Error in fetchFollowing:', error);
      return [];
  }
};

/**
 * Toggle follow status for a user (already optimized)
 */
export const toggleFollowStatus = async (
  currentUserId: string, 
  targetUserId: string, 
  currentlyFollowing: boolean
) => {
  try {
    if (currentlyFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);
      
      if (error) throw error;
      console.log(`User ${currentUserId} unfollowed ${targetUserId}`);
      return false; // Not following anymore
    } else {
      // Follow
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: currentUserId,
          following_id: targetUserId
        });
      
      if (error) throw error;
      console.log(`User ${currentUserId} followed ${targetUserId}`);
      return true; // Now following
    }
  } catch (error) {
    console.error('Error in toggleFollowStatus:', error);
    throw error;
  }
};
