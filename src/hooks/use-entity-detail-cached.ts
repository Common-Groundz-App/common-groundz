
import { useQuery } from '@tanstack/react-query';
import { fetchEntityBySlug, fetchEntityRecommendations, fetchEntityReviews, getEntityStats } from '@/services/entityService';
import { Entity } from '@/services/recommendation/types';
import { RecommendationWithUser, ReviewWithUser } from '@/types/entities';
import { useAuth } from '@/contexts/AuthContext';

export interface EntityStats {
  recommendationCount: number;
  reviewCount: number;
  averageRating: number | null;
  circleRecommendationCount: number;
}

export interface EntityDetailData {
  entity: Entity | null;
  recommendations: RecommendationWithUser[];
  reviews: ReviewWithUser[];
  stats: EntityStats | null;
  isLoading: boolean;
  error: string | null;
}

export const useEntityDetailCached = (slug: string): EntityDetailData => {
  const { user } = useAuth();
  
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ['entity-detail', slug, user?.id],
    queryFn: async () => {
      console.log('🔍 Fetching entity detail for slug:', slug);
      
      // Fetch entity first
      const entity = await fetchEntityBySlug(slug);
      if (!entity) {
        throw new Error('Entity not found');
      }
      
      // Fetch related data in parallel
      const [recommendations, reviews, stats] = await Promise.all([
        fetchEntityRecommendations(entity.id, user?.id || null),
        fetchEntityReviews(entity.id, user?.id || null),
        getEntityStats(entity.id, user?.id || null)
      ]);
      
      return {
        entity,
        recommendations,
        reviews,
        stats
      };
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 2, // 2 minutes (reduced for faster updates after claims)
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  return {
    entity: data?.entity || null,
    recommendations: data?.recommendations || [],
    reviews: data?.reviews || [],
    stats: data?.stats || null,
    isLoading,
    error: error?.message || null
  };
};
