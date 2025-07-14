import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMutualEntityFollowersManual, MutualFollower } from '@/services/socialEntityFollowService';

export const useMutualEntityFollowers = (entityId: string) => {
  const { user } = useAuth();
  const [mutualFollowers, setMutualFollowers] = useState<MutualFollower[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMutualFollowers = async () => {
      if (!entityId || !user) {
        setMutualFollowers([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Use the manual implementation which is more reliable
        const followers = await getMutualEntityFollowersManual(entityId, user.id);
        setMutualFollowers(followers);
      } catch (err) {
        console.error('Error fetching mutual followers:', err);
        setError('Failed to load mutual followers');
        setMutualFollowers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMutualFollowers();
  }, [entityId, user]);

  return {
    mutualFollowers,
    count: mutualFollowers.length,
    isLoading,
    error
  };
};
