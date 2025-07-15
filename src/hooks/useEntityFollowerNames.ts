import { useState, useEffect } from 'react';
import { getEntityFollowerNames, getEntityFollowers, type EntityFollowerProfile } from '@/services/entityFollowService';

export const useEntityFollowerNames = (entityId: string, limit: number = 3) => {
  const [followerNames, setFollowerNames] = useState<EntityFollowerProfile[]>([]);
  const [totalFollowersCount, setTotalFollowersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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