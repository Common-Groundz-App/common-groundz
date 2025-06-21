
import { QueryClient } from '@tanstack/react-query';

class CacheInvalidationService {
  private queryClient: QueryClient | null = null;

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  // Entity-related invalidations
  invalidateEntity(entityId: string) {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating entity cache:', entityId);
    this.queryClient.invalidateQueries({ queryKey: ['entity'] });
    this.queryClient.invalidateQueries({ queryKey: ['entity-recommendations', entityId] });
    this.queryClient.invalidateQueries({ queryKey: ['entity-reviews', entityId] });
    this.queryClient.invalidateQueries({ queryKey: ['entity-stats', entityId] });
  }

  // User interaction invalidations
  invalidateUserInteractions(userId: string) {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating user interactions:', userId);
    this.queryClient.invalidateQueries({ queryKey: ['user-interactions', userId] });
  }

  // Profile-related invalidations
  invalidateProfile(userId: string) {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating profile cache:', userId);
    this.queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    this.queryClient.invalidateQueries({ queryKey: ['profiles'] });
  }

  // Recommendation-specific invalidations
  invalidateRecommendation(recommendationId: string, entityId?: string) {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating recommendation cache:', recommendationId);
    this.queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    
    if (entityId) {
      this.queryClient.invalidateQueries({ queryKey: ['entity-recommendations', entityId] });
      this.queryClient.invalidateQueries({ queryKey: ['entity-stats', entityId] });
    }
  }

  // Review-specific invalidations
  invalidateReview(reviewId: string, entityId?: string) {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating review cache:', reviewId);
    this.queryClient.invalidateQueries({ queryKey: ['reviews'] });
    
    if (entityId) {
      this.queryClient.invalidateQueries({ queryKey: ['entity-reviews', entityId] });
      this.queryClient.invalidateQueries({ queryKey: ['entity-stats', entityId] });
    }
  }

  // Feed-related invalidations
  invalidateFeed() {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating feed cache');
    this.queryClient.invalidateQueries({ queryKey: ['feed'] });
    this.queryClient.invalidateQueries({ queryKey: ['posts'] });
  }

  // Smart batch invalidation for related data
  invalidateEntityEcosystem(entityId: string) {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating entity ecosystem:', entityId);
    
    // Invalidate the entity itself
    this.invalidateEntity(entityId);
    
    // Invalidate any feeds that might contain this entity
    this.queryClient.invalidateQueries({ queryKey: ['feed'] });
    this.queryClient.invalidateQueries({ queryKey: ['explore'] });
    
    // Invalidate search results that might contain this entity
    this.queryClient.invalidateQueries({ queryKey: ['search'] });
  }

  // Invalidate user's entire ecosystem when they perform actions
  invalidateUserEcosystem(userId: string) {
    if (!this.queryClient) return;
    
    console.log('🔄 Invalidating user ecosystem:', userId);
    
    // User-specific data
    this.invalidateProfile(userId);
    this.invalidateUserInteractions(userId);
    
    // User's content
    this.queryClient.invalidateQueries({ queryKey: ['recommendations', userId] });
    this.queryClient.invalidateQueries({ queryKey: ['reviews', userId] });
    this.queryClient.invalidateQueries({ queryKey: ['posts', userId] });
    
    // Social data
    this.queryClient.invalidateQueries({ queryKey: ['followers', userId] });
    this.queryClient.invalidateQueries({ queryKey: ['following', userId] });
  }

  // Cache warming for popular entities
  warmPopularEntities(entityIds: string[]) {
    if (!this.queryClient) return;
    
    console.log('🔥 Warming cache for popular entities:', entityIds.length);
    
    entityIds.forEach(entityId => {
      // Prefetch without waiting
      this.queryClient.prefetchQuery({
        queryKey: ['entity-stats', entityId],
        queryFn: () => import('@/services/entityService').then(s => s.getEntityStats(entityId)),
        staleTime: 1000 * 60 * 10,
      });
    });
  }

  // Clear stale cache entries
  clearStaleCache() {
    if (!this.queryClient) return;
    
    console.log('🧹 Clearing stale cache entries');
    
    const cache = this.queryClient.getQueryCache();
    const queries = cache.getAll();
    
    queries.forEach(query => {
      if (query.isStale() && !query.isFetching()) {
        cache.remove(query);
      }
    });
  }
}

export const cacheInvalidationService = new CacheInvalidationService();

// Hook to initialize the service
export const useCacheInvalidationService = (queryClient: QueryClient) => {
  cacheInvalidationService.setQueryClient(queryClient);
  return cacheInvalidationService;
};
