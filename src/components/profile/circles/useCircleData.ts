
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserProfile } from './types';
import { fetchFollowers, fetchFollowing } from './api/circleService';
import { useFollowActions } from './hooks/useFollowActions';

export const useCircleData = (profileUserId: string, currentUserId?: string) => {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  
  const { actionLoading, handleFollowToggle: toggleFollow } = useFollowActions(currentUserId);

  // Fetch followers using React Query
  const { 
    data: followerProfiles,
    isLoading: isLoadingFollowers,
    error: followerError
  } = useQuery({
    queryKey: ['followers', profileUserId, currentUserId],
    queryFn: () => fetchFollowers(profileUserId, currentUserId),
    enabled: !!profileUserId,
  });
  
  // Fetch following using React Query
  const { 
    data: followingProfiles,
    isLoading: isLoadingFollowing,
    error: followingError
  } = useQuery({
    queryKey: ['following', profileUserId, currentUserId],
    queryFn: () => fetchFollowing(profileUserId, currentUserId),
    enabled: !!profileUserId,
  });
  
  // Update state when data is fetched
  useEffect(() => {
    if (followerProfiles) {
      setFollowers(followerProfiles);
    }
  }, [followerProfiles]);
  
  useEffect(() => {
    if (followingProfiles) {
      setFollowing(followingProfiles);
    }
  }, [followingProfiles]);

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
    isLoading: isLoadingFollowers || isLoadingFollowing,
    actionLoading,
    handleFollowToggle,
    error: followerError || followingError
  };
};
