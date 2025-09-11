import { QueryClient } from '@tanstack/react-query';

/**
 * Utility to invalidate entity detail cache after updates
 */
export const invalidateEntityCache = (queryClient: QueryClient, entitySlug: string, userId?: string) => {
  // Invalidate the specific entity query with user context
  queryClient.invalidateQueries({
    queryKey: ['entity-detail', entitySlug, userId]
  });
  
  // Invalidate basic entity cache too
  queryClient.invalidateQueries({
    queryKey: ['entity', entitySlug, userId]
  });
  
  // Also invalidate any potential entity list queries
  queryClient.invalidateQueries({
    queryKey: ['entities']
  });
};

/**
 * Force refresh entity data by removing it from cache and refetching
 */
export const forceRefreshEntity = async (queryClient: QueryClient, entitySlug: string, userId?: string) => {
  // Remove from cache
  queryClient.removeQueries({
    queryKey: ['entity-detail', entitySlug, userId]
  });
  
  queryClient.removeQueries({
    queryKey: ['entity', entitySlug, userId]
  });
  
  // Refetch the data
  await queryClient.refetchQueries({
    queryKey: ['entity-detail', entitySlug, userId]
  });
};