
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEntityBySlug } from '@/services/entityService';
import { Entity } from '@/services/recommendation/types';
import { useAuth } from '@/contexts/AuthContext';

interface UseEntityCacheProps {
  slugOrId: string;
  enabled?: boolean;
}

export const useEntityCache = ({ slugOrId, enabled = true }: UseEntityCacheProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    data: entity,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['entity', slugOrId, user?.id],
    queryFn: () => fetchEntityBySlug(slugOrId, user?.id),
    enabled: !!slugOrId && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  });

  // Cache actions
  const invalidateEntity = () => {
    queryClient.invalidateQueries({ queryKey: ['entity', slugOrId, user?.id] });
  };

  const updateEntityCache = (updatedEntity: Entity) => {
    queryClient.setQueryData(['entity', slugOrId, user?.id], updatedEntity);
  };

  const prefetchEntity = (entitySlugOrId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['entity', entitySlugOrId, user?.id],
      queryFn: () => fetchEntityBySlug(entitySlugOrId, user?.id),
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
  const { user } = useAuth();

  const prefetchEntities = (entitySlugs: string[]) => {
    entitySlugs.forEach(slug => {
      queryClient.prefetchQuery({
        queryKey: ['entity', slug, user?.id],
        queryFn: () => fetchEntityBySlug(slug, user?.id),
        staleTime: 1000 * 60 * 10,
      });
    });
  };

  return { prefetchEntities };
};
