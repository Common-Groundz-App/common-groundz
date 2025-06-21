
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchEntityRecommendations, 
  fetchEntityReviews, 
  getEntityStats 
} from '@/services/entityService';

interface EntityDataCacheProps {
  entityId: string;
  enabled?: boolean;
}

export const useEntityDataCache = ({ entityId, enabled = true }: EntityDataCacheProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Cache entity recommendations
  const {
    data: recommendations,
    isLoading: recommendationsLoading,
    error: recommendationsError
  } = useQuery({
    queryKey: ['entity-recommendations', entityId, user?.id],
    queryFn: () => fetchEntityRecommendations(entityId, user?.id || null),
    enabled: !!entityId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
    refetchOnWindowFocus: false,
  });

  // Cache entity reviews
  const {
    data: reviews,
    isLoading: reviewsLoading,
    error: reviewsError
  } = useQuery({
    queryKey: ['entity-reviews', entityId, user?.id],
    queryFn: () => fetchEntityReviews(entityId, user?.id || null),
    enabled: !!entityId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
    refetchOnWindowFocus: false,
  });

  // Cache entity stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError
  } = useQuery({
    queryKey: ['entity-stats', entityId],
    queryFn: () => getEntityStats(entityId),
    enabled: !!entityId && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes (stats change less frequently)
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  });

  const isLoading = recommendationsLoading || reviewsLoading || statsLoading;
  const error = recommendationsError || reviewsError || statsError;

  // Cache invalidation functions
  const invalidateEntityData = () => {
    queryClient.invalidateQueries({ queryKey: ['entity-recommendations', entityId] });
    queryClient.invalidateQueries({ queryKey: ['entity-reviews', entityId] });
    queryClient.invalidateQueries({ queryKey: ['entity-stats', entityId] });
  };

  const invalidateRecommendations = () => {
    queryClient.invalidateQueries({ queryKey: ['entity-recommendations', entityId] });
  };

  const invalidateReviews = () => {
    queryClient.invalidateQueries({ queryKey: ['entity-reviews', entityId] });
  };

  const invalidateStats = () => {
    queryClient.invalidateQueries({ queryKey: ['entity-stats', entityId] });
  };

  // Prefetch related entity data
  const prefetchEntityData = (relatedEntityId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['entity-recommendations', relatedEntityId, user?.id],
      queryFn: () => fetchEntityRecommendations(relatedEntityId, user?.id || null),
      staleTime: 1000 * 60 * 5,
    });

    queryClient.prefetchQuery({
      queryKey: ['entity-reviews', relatedEntityId, user?.id],
      queryFn: () => fetchEntityReviews(relatedEntityId, user?.id || null),
      staleTime: 1000 * 60 * 5,
    });

    queryClient.prefetchQuery({
      queryKey: ['entity-stats', relatedEntityId],
      queryFn: () => getEntityStats(relatedEntityId),
      staleTime: 1000 * 60 * 10,
    });
  };

  return {
    recommendations: recommendations || [],
    reviews: reviews || [],
    stats: stats || {
      recommendationCount: 0,
      reviewCount: 0,
      averageRating: null
    },
    isLoading,
    error,
    invalidateEntityData,
    invalidateRecommendations,
    invalidateReviews,
    invalidateStats,
    prefetchEntityData
  };
};
