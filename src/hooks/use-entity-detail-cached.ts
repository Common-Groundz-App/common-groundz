import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';
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
  redirectToSlug: string | null;
  isLoading: boolean;          // Initial load only (no cached data)
  isFetching: boolean;          // Any fetch (initial + background)
  isRefetching: boolean;        // Background refetch only (has cached data)
  error: string | null;
}

export const useEntityDetailCached = (slug: string): EntityDetailData => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // GUARDRAIL #2: Seed with undefined sentinel to skip initial invalidation
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  
  const {
    data,
    isLoading,
    isFetching,
    error
  } = useQuery({
    queryKey: ['entity-detail', slug],
    queryFn: async () => {
      console.log('🔍 Fetching entity detail for slug:', slug);
      
      // Fetch entity first using typed result
      const fetchResult = await fetchEntityBySlug(slug);
      if (!fetchResult.entity) {
        throw new Error('Entity not found');
      }
      
      const entity = fetchResult.entity;
      const redirectToSlug = fetchResult.matchedVia === 'history' ? fetchResult.canonicalSlug : null;
      
      const lastRefreshed = entity.metadata?.last_refreshed_at;
      if (lastRefreshed) {
        const daysSinceRefresh = Math.round((Date.now() - new Date(lastRefreshed as string).getTime()) / (24 * 60 * 60 * 1000));
        console.log(`✅ Entity loaded. Last refreshed: ${daysSinceRefresh} days ago (auto-refresh disabled)`);
      } else {
        console.log(`✅ Entity loaded. Never refreshed (auto-refresh disabled)`);
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
        stats,
        redirectToSlug
      };
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
  });

  // Invalidate cache when user actually changes (sign in/out)
  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;
    
    if (previousUserId === undefined) {
      console.log('🔧 Initial mount, recording user ID:', currentUserId);
      previousUserIdRef.current = currentUserId;
      return;
    }
    
    if (previousUserId !== currentUserId) {
      console.log('🔄 User changed, invalidating entity cache:', { 
        from: previousUserId, 
        to: currentUserId,
        slug 
      });
      queryClient.invalidateQueries({ queryKey: ['entity-detail', slug] });
      previousUserIdRef.current = currentUserId;
    }
  }, [user?.id, slug, queryClient]);

  return {
    entity: data?.entity || null,
    recommendations: data?.recommendations || [],
    reviews: data?.reviews || [],
    stats: data?.stats || null,
    redirectToSlug: data?.redirectToSlug || null,
    isLoading,
    isFetching,
    isRefetching: isFetching && !!data,
    error: error?.message || null
  };
};
