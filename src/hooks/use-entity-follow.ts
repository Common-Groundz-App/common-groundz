
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  followEntity, 
  unfollowEntity, 
  isFollowingEntity, 
  getEntityFollowers 
} from '@/services/entityFollowService';

export const useEntityFollow = (entityId: string) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔍 [useEntityFollow] Checking follow status for entity:', entityId);
        
        // Get followers count (always available)
        const count = await getEntityFollowers(entityId);
        console.log('🔍 [useEntityFollow] Got followers count:', count);
        setFollowersCount(count);

        // Check if current user is following (only if authenticated)
        if (user) {
          const following = await isFollowingEntity(entityId);
          console.log('🔍 [useEntityFollow] User following status:', following);
          setIsFollowing(following);
        } else {
          setIsFollowing(false);
        }
      } catch (error) {
        console.error('❌ [useEntityFollow] Error checking follow status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkFollowStatus();
  }, [entityId, user]);

  const toggleFollow = async () => {
    if (!user || !entityId) return;

    try {
      if (isFollowing) {
        await unfollowEntity(entityId);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        await followEntity(entityId);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  return {
    isFollowing,
    followersCount,
    isLoading,
    toggleFollow,
    canFollow: !!user
  };
};
