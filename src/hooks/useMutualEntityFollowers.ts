
import { useState, useEffect } from 'react';
import { getMutualEntityFollowers, MutualFollowersResult } from '@/services/mutualFollowersService';
import { useAuth } from '@/contexts/AuthContext';

export const useMutualEntityFollowers = (entityId?: string) => {
  const { user } = useAuth();
  const [data, setData] = useState<MutualFollowersResult>({ mutualFollowers: [], count: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMutualFollowers = async () => {
      if (!user || !entityId) {
        setData({ mutualFollowers: [], count: 0 });
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await getMutualEntityFollowers(entityId, user.id);
        setData(result);
      } catch (err) {
        console.error('Error fetching mutual followers:', err);
        setError('Failed to load mutual followers');
        setData({ mutualFollowers: [], count: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMutualFollowers();
  }, [entityId, user]);

  return {
    mutualFollowers: data.mutualFollowers,
    count: data.count,
    isLoading,
    error
  };
};
