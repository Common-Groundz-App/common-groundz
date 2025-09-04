import { QueryClient } from '@tanstack/react-query';

/**
 * Utility to invalidate entity detail cache after updates
 */
export const invalidateEntityCache = (queryClient: QueryClient, entitySlug: string) => {
  // Invalidate the specific entity query
  queryClient.invalidateQueries({
    queryKey: ['entity-detail', entitySlug]
  });
  
  // Also invalidate any potential entity list queries
  queryClient.invalidateQueries({
    queryKey: ['entities']
  });
};

/**
 * Force refresh entity data by removing it from cache and refetching
 */
export const forceRefreshEntity = async (queryClient: QueryClient, entitySlug: string) => {
  // Remove from cache
  queryClient.removeQueries({
    queryKey: ['entity-detail', entitySlug]
  });
  
  // Refetch the data
  await queryClient.refetchQueries({
    queryKey: ['entity-detail', entitySlug]
  });
};