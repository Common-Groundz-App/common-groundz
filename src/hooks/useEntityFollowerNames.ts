import { useState, useEffect } from 'react';
import { getEntityFollowerNames, type EntityFollowerProfile } from '@/services/entityFollowService';

export const useEntityFollowerNames = (entityId: string, limit: number = 3) => {
  const [followerNames, setFollowerNames] = useState<EntityFollowerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFollowerNames = async () => {
      if (!entityId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const names = await getEntityFollowerNames(entityId, limit);
        setFollowerNames(names);
      } catch (error) {
        console.error('Error fetching follower names:', error);
        setFollowerNames([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowerNames();
  }, [entityId, limit]);

  return {
    followerNames,
    isLoading,
  };
};