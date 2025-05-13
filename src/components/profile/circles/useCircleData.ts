
import { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { fetchFollowers, fetchFollowing } from './api/circleService';
import { useFollowActions } from './hooks/useFollowActions';

export const useCircleData = (profileUserId: string, currentUserId?: string) => {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const { actionLoading, handleFollowToggle: toggleFollow } = useFollowActions(currentUserId);

  // Fetch followers and following data
  useEffect(() => {
    const fetchCircles = async () => {
      if (!profileUserId) return;
      
      setIsLoading(true);
      
      try {
        // Fetch followers and following in parallel
        const [followerProfiles, followingProfiles] = await Promise.all([
          fetchFollowers(profileUserId, currentUserId),
          fetchFollowing(profileUserId, currentUserId)
        ]);
        
        console.log(`[useCircleData] Fetched ${followerProfiles.length} followers and ${followingProfiles.length} following for ${profileUserId}`);
        
        setFollowers(followerProfiles);
        setFollowing(followingProfiles);
      } catch (error) {
        console.error('Error fetching circles:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCircles();
  }, [profileUserId, currentUserId]);

  // Updater functions for UI state
  const updateFollowers = (targetUserId: string, isFollowing: boolean) => {
    setFollowers(prev => 
      prev.map(follower => 
        follower.id === targetUserId 
          ? {...follower, isFollowing} 
          : follower
      )
    );
  };
  
  const updateFollowing = (targetUserId: string, isFollowing: boolean) => {
    setFollowing(prev => 
      prev.map(follow => 
        follow.id === targetUserId 
          ? {...follow, isFollowing} 
          : follow
      )
    );
  };

  // Wrapper for follow toggle functionality
  const handleFollowToggle = async (targetUserId: string, currentlyFollowing: boolean) => {
    // Update local state immediately for better UX
    if (currentlyFollowing) {
      updateFollowers(targetUserId, false);
      updateFollowing(targetUserId, false);
    } else {
      updateFollowers(targetUserId, true);
      updateFollowing(targetUserId, true);
    }
    
    // Perform the actual follow/unfollow action
    await toggleFollow(targetUserId, currentlyFollowing, updateFollowers, updateFollowing);
    
    // Dispatch event to update follower/following counts in profile view
    const isActionFollow = !currentlyFollowing;
    const isActionUnfollow = currentlyFollowing;
    
    if (currentUserId === profileUserId) {
      // If user is on their own profile and follows/unfollows someone
      window.dispatchEvent(new CustomEvent('profile-following-count-changed', { 
        detail: { 
          countChange: isActionFollow ? 1 : -1
        } 
      }));
    }
    
    if (targetUserId === profileUserId) {
      // If the user follows/unfollows the profile they're viewing
      window.dispatchEvent(new CustomEvent('profile-follower-count-changed', { 
        detail: { 
          countChange: isActionFollow ? 1 : -1
        } 
      }));
    }
  };

  return {
    followers,
    following,
    isLoading,
    actionLoading,
    handleFollowToggle
  };
};
