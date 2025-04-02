
import { useState, useEffect } from 'react';
import { fetchFollowingCount, fetchFollowerCount } from '@/services/profileService';

export const useProfileCounts = (userId?: string) => {
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);

  // Fetch initial counts
  const fetchCounts = async (id: string) => {
    try {
      const followingData = await fetchFollowingCount(id);
      const followerData = await fetchFollowerCount(id);
      
      setFollowingCount(followingData);
      setFollowerCount(followerData);
    } catch (error) {
      console.error('Error fetching follow counts:', error);
    }
  };

  // Listen for count update events
  useEffect(() => {
    const handleFollowStatusChange = async (event: CustomEvent) => {
      if (!userId) return;
      
      const { follower, following, action } = event.detail;
      
      // If this is the current user's profile and someone followed/unfollowed them
      if (userId === following) {
        // Update follower count
        const updatedFollowerCount = action === 'follow' 
          ? followerCount + 1 
          : Math.max(0, followerCount - 1);
        
        setFollowerCount(updatedFollowerCount);
      }
      
      // If this is the current user and they followed/unfollowed someone else
      if (userId === follower) {
        // Fetch latest following count for accuracy
        const followingData = await fetchFollowingCount(userId);
        setFollowingCount(followingData);
      }
    };

    // Listen for specific follower count update events
    const handleFollowerCountChanged = (event: CustomEvent) => {
      if (event.detail) {
        if (event.detail.immediate && event.detail.countChange) {
          // Apply the change directly to current count
          setFollowerCount(prevCount => Math.max(0, prevCount + event.detail.countChange));
        } else if (typeof event.detail.count === 'number') {
          // Set to a specific value
          setFollowerCount(event.detail.count);
        }
      }
    };

    // Listen for specific following count update events
    const handleFollowingCountChanged = (event: CustomEvent) => {
      if (event.detail) {
        if (event.detail.immediate && event.detail.countChange) {
          // Apply the change directly to current count
          setFollowingCount(prevCount => Math.max(0, prevCount + event.detail.countChange));
        } else if (typeof event.detail.count === 'number') {
          // Set to a specific value
          setFollowingCount(event.detail.count);
        }
      }
    };

    // Add event listeners
    window.addEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    window.addEventListener('profile-follower-count-changed', handleFollowerCountChanged as EventListener);
    window.addEventListener('profile-following-count-changed', handleFollowingCountChanged as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
      window.removeEventListener('profile-follower-count-changed', handleFollowerCountChanged as EventListener);
      window.removeEventListener('profile-following-count-changed', handleFollowingCountChanged as EventListener);
    };
  }, [userId, followerCount]);

  return {
    followerCount,
    followingCount,
    setFollowerCount,
    setFollowingCount,
    fetchCounts
  };
};
