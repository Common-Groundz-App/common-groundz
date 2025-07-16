
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
        
        // Get followers count (always available)
        const count = await getEntityFollowers(entityId);
        setFollowersCount(count);

        // Check if current user is following (only if authenticated)
        if (user) {
          const following = await isFollowingEntity(entityId);
          setIsFollowing(following);
        } else {
          setIsFollowing(false);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkFollowStatus();
  }, [entityId, user]);

  // Listen for global entity follow events to update follower count instantly
  useEffect(() => {
    const handleEntityFollowChange = (event: CustomEvent) => {
      const { entityId: eventEntityId, userId, action } = event.detail;
      
      // Only update if this event is for the current entity
      if (eventEntityId === entityId) {
        console.log(`Entity follow event received: ${action} by user ${userId} for entity ${entityId}`);
        // Calculate count change based on action type
        if (action === 'follow') {
          setFollowersCount(prev => prev + 1);
        } else if (action === 'unfollow') {
          setFollowersCount(prev => Math.max(0, prev - 1));
        }
      }
    };

    window.addEventListener('entity-follow-status-changed', handleEntityFollowChange as EventListener);

    return () => {
      window.removeEventListener('entity-follow-status-changed', handleEntityFollowChange as EventListener);
    };
  }, [entityId, user?.id]);

  const toggleFollow = async () => {
    if (!user || !entityId) return;

    try {
      if (isFollowing) {
        await unfollowEntity(entityId);
        setIsFollowing(false);
        const newCount = Math.max(0, followersCount - 1);
        setFollowersCount(newCount);
        
        // Dispatch global event for real-time updates
        window.dispatchEvent(new CustomEvent('entity-follow-status-changed', { 
          detail: { 
            userId: user.id,
            entityId: entityId,
            action: 'unfollow'
          } 
        }));
      } else {
        await followEntity(entityId);
        setIsFollowing(true);
        const newCount = followersCount + 1;
        setFollowersCount(newCount);
        
        // Dispatch global event for real-time updates
        window.dispatchEvent(new CustomEvent('entity-follow-status-changed', { 
          detail: { 
            userId: user.id,
            entityId: entityId,
            action: 'follow'
          } 
        }));
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
