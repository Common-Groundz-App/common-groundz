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
    // IMPORTANT: Query key does NOT include user?.id to prevent cache invalidation
    // during Supabase token refresh (which briefly sets user to null/undefined).
    // User context is passed to fetchers for personalized data, and cache is
    // explicitly invalidated via useEffect when user actually signs in/out.
    queryKey: ['entity-detail', slug],
    queryFn: async () => {
      console.log('🔍 Fetching entity detail for slug:', slug);
      
      // Fetch entity first
      let entity = await fetchEntityBySlug(slug);
      if (!entity) {
        throw new Error('Entity not found');
      }
      
      // Staleness check: only refresh Google Places entities if data is >7 days old
      const REFRESH_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
      const lastRefreshed = entity.metadata?.last_refreshed_at;
      const isStale = !lastRefreshed || 
        (Date.now() - new Date(lastRefreshed).getTime() > REFRESH_THRESHOLD);
      
      if (entity.type === 'place' && entity.api_source === 'google_places' && isStale && entity.metadata?.place_id) {
        console.log('🔄 Entity stale (>7 days), triggering Google Places refresh...');
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.functions.invoke('refresh-google-places-entity', {
          body: { entityId: entity.id, placeId: entity.metadata.place_id }
        });
        
        // Refetch entity to get updated data
        entity = await fetchEntityBySlug(slug);
      } else if (entity.type === 'place' && !isStale) {
        console.log(`✅ Entity fresh (${Math.round((Date.now() - new Date(lastRefreshed).getTime()) / (24 * 60 * 60 * 1000))} days old), skipping refresh`);
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
    refetchOnWindowFocus: false, // Prevent flicker on tab switch
  });

  // Invalidate cache when user actually changes (sign in/out)
  useEffect(() => {
    const currentUserId = user?.id || null;
    const previousUserId = previousUserIdRef.current;
    
    // GUARDRAIL #2: Skip on initial mount (sentinel value)
    if (previousUserId === undefined) {
      console.log('🔧 Initial mount, recording user ID:', currentUserId);
      previousUserIdRef.current = currentUserId;
      return;
    }
    
    // User changed (sign in/out) - invalidate to refetch with new permissions
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
    isLoading,                                    // Only true on initial load (no cache)
    isFetching,                                   // True during any fetch
    isRefetching: isFetching && !!data,          // True during background refetch (cache exists)
    error: error?.message || null
  };
};
