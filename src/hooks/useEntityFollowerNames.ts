import { useState, useEffect, useCallback, useRef } from 'react';
import { getEntityFollowerNames, getEntityFollowers, type EntityFollowerProfile } from '@/services/entityFollowService';
import { realtimeService } from '@/services/realtimeService';

interface EntityFollowRecord {
  id: string;
  entity_id: string;
  user_id: string;
  created_at: string;
}

export const useEntityFollowerNames = (entityId: string, limit: number = 3) => {
  const [followerNames, setFollowerNames] = useState<EntityFollowerProfile[]>([]);
  const [totalFollowersCount, setTotalFollowersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debouncing ref to prevent excessive updates
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced update function to prevent excessive API calls
  const debouncedUpdate = useCallback(async () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        // Only refresh the data, don't show loading state for real-time updates
        const [names, totalCount] = await Promise.all([
          getEntityFollowerNames(entityId, limit),
          getEntityFollowers(entityId)
        ]);
        
        setFollowerNames(names);
        setTotalFollowersCount(totalCount);
        setError(null);
      } catch (error) {
        console.error('Error updating follower data:', error);
        setError('Failed to update followers');
      }
    }, 300); // 300ms debounce
  }, [entityId, limit]);

  useEffect(() => {
    const fetchFollowerData = async () => {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch both follower names and total count in parallel
        const [names, totalCount] = await Promise.all([
          getEntityFollowerNames(entityId, limit),
          getEntityFollowers(entityId)
        ]);
        
        setFollowerNames(names);
        setTotalFollowersCount(totalCount);
      } catch (error) {
        console.error('Error fetching follower data:', error);
        setError('Failed to load followers');
        setFollowerNames([]);
        setTotalFollowersCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowerData();
  }, [entityId, limit]);

  // Real-time subscription effect
  useEffect(() => {
    if (!entityId) return;

    // Subscribe to entity_follows table changes for this specific entity
    const channelName = realtimeService.subscribeToTable<EntityFollowRecord>(
      'entity_follows',
      {
        onInsert: (payload) => {
          // When someone follows this entity, update the data
          if (payload && (payload as EntityFollowRecord).entity_id === entityId) {
            debouncedUpdate();
          }
        },
        onDelete: (payload) => {
          // When someone unfollows this entity, update the data
          if (payload && (payload as EntityFollowRecord).entity_id === entityId) {
            debouncedUpdate();
          }
        }
      },
      { column: 'entity_id', value: entityId }
    );

    return () => {
      // Cleanup subscription and debounce timeout
      realtimeService.unsubscribe(channelName);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [entityId, debouncedUpdate]);

  const retry = () => {
    setError(null);
    setIsLoading(true);
    // Re-trigger the effect by updating a dependency wouldn't work here
    // Instead, we'll extract the logic to a function we can call
    const fetchFollowerData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [names, totalCount] = await Promise.all([
          getEntityFollowerNames(entityId, limit),
          getEntityFollowers(entityId)
        ]);
        
        setFollowerNames(names);
        setTotalFollowersCount(totalCount);
      } catch (error) {
        console.error('Error fetching follower data:', error);
        setError('Failed to load followers');
        setFollowerNames([]);
        setTotalFollowersCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFollowerData();
  };

  return {
    followerNames,
    totalFollowersCount,
    isLoading,
    error,
    retry,
  };
};