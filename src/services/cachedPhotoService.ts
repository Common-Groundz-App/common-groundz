import { supabase } from '@/integrations/supabase/client';
import { browserPhotoCache } from './browserPhotoCache';

export interface CachedPhoto {
  id: string;
  entity_id: string;
  original_reference: string;
  cached_url: string;
  max_width?: number;
  quality_level: string;
  expires_at: string;
  fetch_count: number;
  last_accessed_at: string;
  created_at: string;
}

export type PhotoQuality = 'high' | 'medium' | 'low';

// Quality presets for different use cases
const QUALITY_PRESETS = {
  high: 1200,     // Hero images, detailed views
  medium: 800,    // Grid views, gallery
  low: 400        // Thumbnails, previews
} as const;

export class CachedPhotoService {
  private static instance: CachedPhotoService;
  
  // In-memory cache for 5 minutes to avoid repeated DB lookups for entity browsing
  private inMemoryCache = new Map<string, { url: string; timestamp: number }>();
  private readonly IN_MEMORY_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Request deduplication to prevent multiple identical requests
  private pendingRequests = new Map<string, Promise<string>>();
  
  // Lazy updates for access tracking (reduce DB load)
  private pendingUpdates = new Map<string, { id: string; lastAccess: number }>();
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  static getInstance(): CachedPhotoService {
    if (!CachedPhotoService.instance) {
      CachedPhotoService.instance = new CachedPhotoService();
      CachedPhotoService.instance.startPeriodicCleanup();
    }
    return CachedPhotoService.instance;
  }

  /**
   * Start periodic cleanup of in-memory cache to prevent memory leaks
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [key, value] of this.inMemoryCache.entries()) {
        if (now - value.timestamp > this.IN_MEMORY_TTL) {
          this.inMemoryCache.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 [PhotoCache] Cleaned ${cleanedCount} expired in-memory cache entries`);
      }
    }, 60 * 1000); // Run cleanup every minute
  }

  /**
   * Get cached photo URL with browser cache + database fallback
   * Optimized to eliminate unnecessary database calls
   */
  async getCachedPhotoUrl(
    photoReference: string, 
    quality: PhotoQuality = 'medium',
    entityId?: string
  ): Promise<string> {
    const startTime = performance.now();
    const maxWidth = QUALITY_PRESETS[quality];
    const cacheKey = `${photoReference}:${maxWidth}`;
    
    try {
      // 1. Check browser cache first (persists across page refreshes)
      const browserCacheResult = browserPhotoCache.get(photoReference, maxWidth);
      if (browserCacheResult) {
        console.log(`🌐 [PhotoCache] Browser cache hit for ${cacheKey} (${(performance.now() - startTime).toFixed(1)}ms)`);
        return browserCacheResult;
      }
      
      // 2. Check in-memory cache (fastest for current session)
      const inMemoryResult = this.getFromInMemoryCache(cacheKey);
      if (inMemoryResult) {
        // Store in browser cache for future page loads
        browserPhotoCache.set(photoReference, maxWidth, inMemoryResult, quality);
        console.log(`🚀 [PhotoCache] In-memory hit for ${cacheKey} (${(performance.now() - startTime).toFixed(1)}ms)`);
        return inMemoryResult;
      }
      
      // 3. Check for duplicate requests (deduplication)
      if (this.pendingRequests.has(cacheKey)) {
        console.log(`🔄 [PhotoCache] Deduplicating request for ${cacheKey}`);
        return await this.pendingRequests.get(cacheKey)!;
      }
      
      // 4. Create new request and cache it for deduplication
      const requestPromise = this.fetchCachedPhoto(photoReference, maxWidth, quality, startTime, entityId);
      this.pendingRequests.set(cacheKey, requestPromise);
      
      const result = await requestPromise;
      
      // 5. Store in all cache layers and clean up pending request
      this.setInMemoryCache(cacheKey, result);
      browserPhotoCache.set(photoReference, maxWidth, result, quality);
      this.pendingRequests.delete(cacheKey);
      
      console.log(`✅ [PhotoCache] Database lookup for ${cacheKey} (${(performance.now() - startTime).toFixed(1)}ms)`);
      return result;
    } catch (error) {
      console.error('Error getting cached photo URL:', error);
      this.pendingRequests.delete(cacheKey);
      // Fallback to direct proxy URL generation
      return this.createProxyUrl(photoReference, maxWidth);
    }
  }

  /**
   * Internal method to fetch from database cache or generate new URL
   */
  private async fetchCachedPhoto(
    photoReference: string,
    maxWidth: number,
    quality: PhotoQuality,
    startTime: number,
    entityId?: string
  ): Promise<string> {
    // Check database cache
    const cached = await this.getCachedPhoto(photoReference, maxWidth);
    
    if (cached && !this.isExpired(cached.expires_at)) {
      // Schedule lazy update (don't block the response)
      this.scheduleLazyUpdate(cached.id);
      console.log(`💾 [PhotoCache] Database cache hit for ${photoReference}:${maxWidth}`);
      return cached.cached_url;
    }
    
    // Generate fresh proxy URL
    const proxyUrl = this.createProxyUrl(photoReference, maxWidth);
    
    // Cache the new URL for 48 hours (async, don't block)
    this.cachePhotoUrl(photoReference, proxyUrl, maxWidth, quality, entityId)
      .catch(error => console.error('Error caching photo URL:', error));
    
    console.log(`🆕 [PhotoCache] Generated new URL for ${photoReference}:${maxWidth} (${(performance.now() - startTime).toFixed(1)}ms)`);
    return proxyUrl;
  }

  /**
   * Get multiple cached photo URLs with smart batching and browser cache optimization
   */
  async getCachedPhotoUrls(
    photoReferences: string[],
    qualities: PhotoQuality[] = ['medium'], // Single quality - let browser/CSS handle scaling
    entityId?: string
  ): Promise<{ photoReference: string; quality: PhotoQuality; url: string }[]> {
    const startTime = performance.now();
    
    // Create unique combinations to eliminate duplicates within the same request
    const uniqueCombinations = new Map<string, { photoRef: string; quality: PhotoQuality; maxWidth: number }>();
    
    for (const photoRef of photoReferences) {
      for (const quality of qualities) {
        const maxWidth = QUALITY_PRESETS[quality];
        const key = `${photoRef}:${maxWidth}`;
        if (!uniqueCombinations.has(key)) {
          uniqueCombinations.set(key, { photoRef, quality, maxWidth });
        }
      }
    }
    
    console.log(`📊 [PhotoCache] Request deduplication: ${photoReferences.length * qualities.length} requests → ${uniqueCombinations.size} unique combinations`);
    
    // Batch check browser cache first
    const cacheRequests = Array.from(uniqueCombinations.values()).map(({ photoRef, maxWidth }) => ({
      photoReference: photoRef,
      maxWidth
    }));
    
    const browserCacheResults = browserPhotoCache.batchGet(cacheRequests);
    const browserCacheHits = new Map<string, string>();
    
    browserCacheResults.forEach(({ photoReference, maxWidth, url }) => {
      if (url) {
        browserCacheHits.set(`${photoReference}:${maxWidth}`, url);
      }
    });
    
    console.log(`🌐 [PhotoCache] Browser cache hits: ${browserCacheHits.size}/${uniqueCombinations.size}`);
    
    // Only fetch from database/generate for cache misses
    const fetchPromises = Array.from(uniqueCombinations.values()).map(async ({ photoRef, quality, maxWidth }) => {
      const cacheKey = `${photoRef}:${maxWidth}`;
      const browserCacheHit = browserCacheHits.get(cacheKey);
      
      if (browserCacheHit) {
        // Store in in-memory cache too for current session
        this.setInMemoryCache(cacheKey, browserCacheHit);
        return { photoReference: photoRef, quality, url: browserCacheHit };
      }
      
      // Fallback to full cache lookup (in-memory + database)
      const url = await this.getCachedPhotoUrl(photoRef, quality, entityId);
      return { photoReference: photoRef, quality, url };
    });
    
    const results = await Promise.all(fetchPromises);
    
    console.log(`⚡ [PhotoCache] Batch request completed in ${(performance.now() - startTime).toFixed(1)}ms for ${results.length} photos (${browserCacheHits.size} browser cache hits)`);
    return results;
  }

  /**
   * Pre-cache photos for an entity (useful during entity creation)
   */
  async preCacheEntityPhotos(
    entityId: string,
    photoReferences: string[],
    qualities: PhotoQuality[] = ['medium', 'high']
  ): Promise<void> {
    try {
      const cachePromises = [];
      
      for (const photoRef of photoReferences) {
        for (const quality of qualities) {
          cachePromises.push(
            this.getCachedPhotoUrl(photoRef, quality, entityId)
          );
        }
      }
      
      await Promise.all(cachePromises);
    } catch (error) {
      console.error('Error pre-caching entity photos:', error);
    }
  }

  /**
   * Check if cached photo exists and is not expired
   */
  private async getCachedPhoto(
    photoReference: string, 
    maxWidth: number
  ): Promise<CachedPhoto | null> {
    const { data, error } = await supabase
      .from('cached_photos')
      .select('*')
      .eq('original_reference', photoReference)
      .eq('max_width', maxWidth)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching cached photo:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Check if cached photo is expired (older than 48 hours)
   */
  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  /**
   * Update last accessed timestamp and increment fetch count
   */
  private async updateLastAccessed(cachedPhotoId: string): Promise<void> {
    try {
      // First get current fetch count
      const { data: currentPhoto } = await supabase
        .from('cached_photos')
        .select('fetch_count')
        .eq('id', cachedPhotoId)
        .single();
        
      const newFetchCount = (currentPhoto?.fetch_count || 0) + 1;
      
      await supabase
        .from('cached_photos')
        .update({
          last_accessed_at: new Date().toISOString(),
          fetch_count: newFetchCount
        })
        .eq('id', cachedPhotoId);
    } catch (error) {
      console.error('Error updating last accessed:', error);
    }
  }

  /**
   * Cache a photo URL with 48-hour expiry
   */
  private async cachePhotoUrl(
    photoReference: string,
    cachedUrl: string,
    maxWidth: number,
    quality: PhotoQuality,
    entityId?: string
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days (extended for legacy entities)
      
      const { error } = await supabase
        .from('cached_photos')
        .insert({
          entity_id: entityId,
          original_reference: photoReference,
          cached_url: cachedUrl,
          max_width: maxWidth,
          quality_level: quality,
          expires_at: expiresAt.toISOString(),
          fetch_count: 1,
          last_accessed_at: new Date().toISOString(),
          source: 'google_places'
        });
        
      if (error) {
        console.error('Error caching photo URL:', error);
      }
    } catch (error) {
      console.error('Error caching photo URL:', error);
    }
  }

  /**
   * Create proxy URL for Google Places photo
   */
  private createProxyUrl(photoReference: string, maxWidth: number): string {
    const baseUrl = 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image';
    return `${baseUrl}?ref=${encodeURIComponent(photoReference)}&maxWidth=${maxWidth}`;
  }

  /**
   * Clean up expired cached photos (for maintenance)
   */
  async cleanupExpiredPhotos(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_cached_photos');
      
      if (error) {
        console.error('Error cleaning up expired photos:', error);
        return 0;
      }
      
      return data || 0;
    } catch (error) {
      console.error('Error cleaning up expired photos:', error);
      return 0;
    }
  }

  /**
   * Get from in-memory cache if available and not expired
   */
  private getFromInMemoryCache(cacheKey: string): string | null {
    const cached = this.inMemoryCache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.IN_MEMORY_TTL;
    if (isExpired) {
      this.inMemoryCache.delete(cacheKey);
      return null;
    }
    
    return cached.url;
  }

  /**
   * Set in-memory cache with current timestamp
   */
  private setInMemoryCache(cacheKey: string, url: string): void {
    this.inMemoryCache.set(cacheKey, {
      url,
      timestamp: Date.now()
    });
  }

  /**
   * Schedule lazy update for access tracking (reduces DB load)
   */
  private scheduleLazyUpdate(cachedPhotoId: string): void {
    const now = Date.now();
    const existingUpdate = this.pendingUpdates.get(cachedPhotoId);
    
    // Only update if it's been more than UPDATE_INTERVAL since last update
    if (!existingUpdate || (now - existingUpdate.lastAccess) > this.UPDATE_INTERVAL) {
      this.pendingUpdates.set(cachedPhotoId, { id: cachedPhotoId, lastAccess: now });
      
      // Process update after a short delay (non-blocking)
      setTimeout(() => {
        this.updateLastAccessed(cachedPhotoId).catch(console.error);
        this.pendingUpdates.delete(cachedPhotoId);
      }, 100);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    expired: number;
    byQuality: Record<string, number>;
    byEntity: Record<string, number>;
  }> {
    try {
      const { data: totalData } = await supabase
        .from('cached_photos')
        .select('*', { count: 'exact', head: true });
        
      const { data: expiredData } = await supabase
        .from('cached_photos')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString());

      const { data: qualityData } = await supabase
        .from('cached_photos')
        .select('quality_level')
        .gte('expires_at', new Date().toISOString());

      const { data: entityData } = await supabase
        .from('cached_photos')
        .select('entity_id')
        .gte('expires_at', new Date().toISOString())
        .not('entity_id', 'is', null);

      // Group by quality
      const byQuality: Record<string, number> = {};
      qualityData?.forEach(item => {
        byQuality[item.quality_level] = (byQuality[item.quality_level] || 0) + 1;
      });

      // Group by entity
      const byEntity: Record<string, number> = {};
      entityData?.forEach(item => {
        if (item.entity_id) {
          byEntity[item.entity_id] = (byEntity[item.entity_id] || 0) + 1;
        }
      });

      return {
        totalCached: totalData?.length || 0,
        expired: expiredData?.length || 0,
        byQuality,
        byEntity
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalCached: 0,
        expired: 0,
        byQuality: {},
        byEntity: {}
      };
    }
  }
}

// Export singleton instance
export const cachedPhotoService = CachedPhotoService.getInstance();