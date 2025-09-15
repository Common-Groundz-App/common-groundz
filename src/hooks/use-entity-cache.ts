
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEntityBySlug } from '@/services/entityService';
import { Entity } from '@/services/recommendation/types';

interface UseEntityCacheProps {
  slugOrId: string;
  enabled?: boolean;
}

export const useEntityCache = ({ slugOrId, enabled = true }: UseEntityCacheProps) => {
  const queryClient = useQueryClient();

  const {
    data: entity,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['entity', slugOrId],
    queryFn: () => fetchEntityBySlug(slugOrId),
    enabled: !!slugOrId && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  });

  // Cache actions
  const invalidateEntity = () => {
    queryClient.invalidateQueries({ queryKey: ['entity', slugOrId] });
  };

  const updateEntityCache = (updatedEntity: Entity) => {
    queryClient.setQueryData(['entity', slugOrId], updatedEntity);
  };

  const prefetchEntity = (entitySlugOrId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['entity', entitySlugOrId],
      queryFn: () => fetchEntityBySlug(entitySlugOrId),
      staleTime: 1000 * 60 * 10,
    });
  };

  return {
    entity,
    isLoading,
    error,
    refetch,
    invalidateEntity,
    updateEntityCache,
    prefetchEntity
  };
};

// Hook for batch entity prefetching
export const useEntityPrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchEntities = (entitySlugs: string[]) => {
    entitySlugs.forEach(slug => {
      queryClient.prefetchQuery({
        queryKey: ['entity', slug],
        queryFn: () => fetchEntityBySlug(slug),
        staleTime: 1000 * 60 * 10,
      });
    });
  };

  return { prefetchEntities };
};
