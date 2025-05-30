
import { useState, useEffect } from 'react';
import { fetchFollowerCount, fetchFollowingCount } from '@/services/profileService';

export const useProfileFollows = (userId?: string) => {
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);

  useEffect(() => {
    const fetchCounts = async () => {
      if (userId) {
        try {
          const followerData = await fetchFollowerCount(userId);
          const followingData = await fetchFollowingCount(userId);
          
          setFollowerCount(followerData);
          setFollowingCount(followingData);
        } catch (error) {
          console.error('Error fetching follow counts:', error);
        }
      }
    };
    
    fetchCounts();

    const handleFollowStatusChange = (event: CustomEvent) => {
      if (!userId) return;
      
      const { follower, following, action } = event.detail;
      
      if (userId === following) {
        const updatedFollowerCount = action === 'follow' 
          ? followerCount + 1 
          : Math.max(0, followerCount - 1);
        setFollowerCount(updatedFollowerCount);
      }
      
      if (userId === follower) {
        fetchFollowingCount(userId).then(count => setFollowingCount(count));
      }
    };

    const handleFollowerCountChanged = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.count === 'number') {
        setFollowerCount(event.detail.count);
      }
    };

    const handleFollowingCountChanged = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.count === 'number') {
        setFollowingCount(event.detail.count);
      }
    };

    window.addEventListener('follow-status-changed', handleFollowStatusChange as EventListener);
    window.addEventListener('profile-follower-count-changed', handleFollowerCountChanged as EventListener);
    window.addEventListener('profile-following-count-changed', handleFollowingCountChanged as EventListener);
    
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
    setFollowingCount
  };
};
