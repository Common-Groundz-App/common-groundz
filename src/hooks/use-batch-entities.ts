import { useQuery } from '@tanstack/react-query';
import { fetchEntitiesByIds } from '@/services/entityBatchService';
import { Entity } from '@/services/recommendation/types';

/**
 * Hook to batch fetch entities by IDs using React Query.
 * Caches results for 5 minutes to avoid redundant fetches.
 */
export const useBatchEntities = (entityIds: string[]) => {
  // Filter out empty IDs and deduplicate
  const validIds = [...new Set(entityIds.filter(id => id && id.length > 0))];
  
  return useQuery<Map<string, Entity>>({
    queryKey: ['entities-batch', validIds.sort().join(',')],
    queryFn: () => fetchEntitiesByIds(validIds),
    enabled: validIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
};
