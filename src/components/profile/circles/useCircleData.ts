
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
    await toggleFollow(targetUserId, currentlyFollowing, updateFollowers, updateFollowing);
  };

  return {
    followers,
    following,
    isLoading,
    actionLoading,
    handleFollowToggle
  };
};
