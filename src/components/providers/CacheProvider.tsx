
import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCacheInvalidationService } from '@/services/cacheInvalidationService';

interface CacheProviderProps {
  children: React.ReactNode;
}

export const CacheProvider: React.FC<CacheProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const cacheInvalidationService = useCacheInvalidationService(queryClient);

  useEffect(() => {
    // Set up cache warming for popular entities on app start
    const warmCache = async () => {
      try {
        // You could fetch popular entity IDs from an API or use static ones
        const popularEntityIds = []; // This would come from your analytics
        cacheInvalidationService.warmPopularEntities(popularEntityIds);
      } catch (error) {
        console.warn('Failed to warm cache:', error);
      }
    };

    warmCache();

    // Set up periodic stale cache cleanup
    const cleanup = setInterval(() => {
      cacheInvalidationService.clearStaleCache();
    }, 1000 * 60 * 10); // Every 10 minutes

    return () => {
      clearInterval(cleanup);
    };
  }, [cacheInvalidationService]);

  // Global cache event listeners could be added here
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Optionally refetch critical data when user returns to tab
        queryClient.invalidateQueries({
          stale: true,
          predicate: ({ queryKey }) => queryKey[0] !== 'entity-detail',
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

  return <>{children}</>;
};
