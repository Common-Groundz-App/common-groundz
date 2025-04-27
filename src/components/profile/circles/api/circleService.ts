
import { supabase } from '@/integrations/supabase/client';
import { UserProfile } from '../types';

/**
 * Fetch followers for a profile user - returns ALL followers
 */
export const fetchFollowers = async (profileUserId: string, currentUserId?: string) => {
  try {
    // Fetch followers (people who follow the profile user)
    const { data: followersData, error: followersError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', profileUserId);
    
    if (followersError) throw followersError;
    
    // Fetch the profile data for each follower
    const followerProfiles: UserProfile[] = [];
    
    if (followersData && followersData.length > 0) {
      const followerIds = followersData.map(item => item.follower_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', followerIds);
      
      if (profilesError) throw profilesError;
      
      if (profilesData) {
        // If the current user is logged in, check which users they follow
        let userFollowingIds: string[] = [];
        if (currentUserId) {
          const { data: userFollowing, error: userFollowingError } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUserId);
          
          if (!userFollowingError && userFollowing) {
            userFollowingIds = userFollowing.map(f => f.following_id);
          }
        }
        
        // Process the profiles - include all followers regardless of mutual follow status
        profilesData.forEach(profile => {
          followerProfiles.push({
            id: profile.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
            isFollowing: userFollowingIds.includes(profile.id)
          });
        });
      }
    }
    
    return followerProfiles;
  } catch (error) {
    console.error('Error fetching followers:', error);
    throw error;
  }
};

/**
 * Fetch following for a profile user - returns ALL users they follow
 */
export const fetchFollowing = async (profileUserId: string, currentUserId?: string) => {
  try {
    // Fetch following (people the profile user follows)
    const { data: followingData, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profileUserId);
    
    if (followingError) throw followingError;
    
    // Fetch the profile data for each following
    const followingProfiles: UserProfile[] = [];
    
    if (followingData && followingData.length > 0) {
      const followingIds = followingData.map(item => item.following_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', followingIds);
      
      if (profilesError) throw profilesError;
      
      if (profilesData) {
        // If the current user is logged in, check which users they follow
        let userFollowingIds: string[] = [];
        if (currentUserId) {
          const { data: userFollowing, error: userFollowingError } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUserId);
          
          if (!userFollowingError && userFollowing) {
            userFollowingIds = userFollowing.map(f => f.following_id);
          }
        }
        
        // Process the profiles - include all users regardless of mutual follow status
        profilesData.forEach(profile => {
          followingProfiles.push({
            id: profile.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
            isFollowing: userFollowingIds.includes(profile.id)
          });
        });
      }
    }
    
    return followingProfiles;
  } catch (error) {
    console.error('Error fetching following:', error);
    throw error;
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
};
