
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '../types';

/**
 * Fetch followers for a profile user using RPC
 */
export const fetchFollowers = async (profileUserId: string, currentUserId?: string): Promise<UserProfile[]> => {
  try {
    const { data: followersData, error: followersError } = await supabase
      .rpc('get_followers_with_profiles', {
        profile_user_id: profileUserId,
        current_user_id: currentUserId || null
      });
    
    if (followersError) {
      console.error('Error fetching followers:', followersError);
      return [];
    }
    
    return followersData || [];
  } catch (error) {
    console.error('Error in fetchFollowers:', error);
    return [];
  }
};

/**
 * Fetch following for a profile user using RPC
 */
export const fetchFollowing = async (profileUserId: string, currentUserId?: string): Promise<UserProfile[]> => {
  try {
    const { data: followingData, error: followingError } = await supabase
      .rpc('get_following_with_profiles', {
        profile_user_id: profileUserId,
        current_user_id: currentUserId || null
      });
    
    if (followingError) {
      console.error('Error fetching following:', followingError);
      return [];
    }
    
    return followingData || [];
  } catch (error) {
    console.error('Error in fetchFollowing:', error);
    return [];
  }
};

/**
 * Toggle follow status for a user
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
      return true; // Now following
    }
  } catch (error) {
    console.error('Error in toggleFollowStatus:', error);
    throw error;
  }
};
