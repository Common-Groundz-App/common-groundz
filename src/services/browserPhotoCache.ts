// Browser-persistent photo cache service using localStorage/sessionStorage
export interface BrowserCachedPhoto {
  url: string;
  timestamp: number;
  ttl: number;
  quality: string;
  photoReference: string;
}

export class BrowserPhotoCacheService {
  private static instance: BrowserPhotoCacheService;
  private readonly CACHE_PREFIX = 'photo_cache_';
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 200; // Maximum cache entries

  static getInstance(): BrowserPhotoCacheService {
    if (!BrowserPhotoCacheService.instance) {
      BrowserPhotoCacheService.instance = new BrowserPhotoCacheService();
    }
    return BrowserPhotoCacheService.instance;
  }

  /**
   * Get photo URL from browser cache
   */
  get(photoReference: string, maxWidth: number): string | null {
    try {
      const cacheKey = this.getCacheKey(photoReference, maxWidth);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const parsedCache: BrowserCachedPhoto = JSON.parse(cached);
      
      // Check if expired
      if (Date.now() - parsedCache.timestamp > parsedCache.ttl) {
        this.delete(photoReference, maxWidth);
        return null;
      }
      
      console.log(`🌐 [BrowserCache] Hit for ${cacheKey}`);
      return parsedCache.url;
    } catch (error) {
      console.warn('Error reading browser cache:', error);
      return null;
    }
  }

  /**
   * Set photo URL in browser cache
   */
  set(photoReference: string, maxWidth: number, url: string, quality: string, ttl?: number): void {
    try {
      const cacheKey = this.getCacheKey(photoReference, maxWidth);
      const cacheData: BrowserCachedPhoto = {
        url,
        timestamp: Date.now(),
        ttl: ttl || this.DEFAULT_TTL,
        quality,
        photoReference
      };
      
      // Ensure cache size doesn't exceed limit
      this.ensureCacheSize();
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`💾 [BrowserCache] Stored ${cacheKey}`);
    } catch (error) {
      console.warn('Error writing to browser cache:', error);
      // If localStorage is full, clear old entries and try again
      this.cleanup();
      try {
        localStorage.setItem(this.getCacheKey(photoReference, maxWidth), JSON.stringify({
          url,
          timestamp: Date.now(),
          ttl: ttl || this.DEFAULT_TTL,
          quality,
          photoReference
        }));
      } catch (retryError) {
        console.warn('Failed to cache after cleanup:', retryError);
      }
    }
  }

  /**
   * Batch get multiple photos from browser cache
   */
  batchGet(requests: { photoReference: string; maxWidth: number }[]): Array<{ photoReference: string; maxWidth: number; url: string | null }> {
    return requests.map(({ photoReference, maxWidth }) => ({
      photoReference,
      maxWidth,
      url: this.get(photoReference, maxWidth)
    }));
  }

  /**
   * Delete specific photo from cache
   */
  delete(photoReference: string, maxWidth: number): void {
    try {
      const cacheKey = this.getCacheKey(photoReference, maxWidth);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('Error deleting from browser cache:', error);
    }
  }

  /**
   * Clear all expired cache entries
   */
  cleanup(): number {
    let cleanedCount = 0;
    try {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const parsedCache: BrowserCachedPhoto = JSON.parse(cached);
              if (now - parsedCache.timestamp > parsedCache.ttl) {
                keysToDelete.push(key);
              }
            }
          } catch (parseError) {
            // Invalid cache entry, mark for deletion
            keysToDelete.push(key);
          }
        }
      }
      
      keysToDelete.forEach(key => {
        localStorage.removeItem(key);
        cleanedCount++;
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 [BrowserCache] Cleaned ${cleanedCount} expired entries`);
      }
    } catch (error) {
      console.warn('Error during cache cleanup:', error);
    }
    
    return cleanedCount;
  }

  /**
   * Ensure cache doesn't exceed maximum size
   */
  private ensureCacheSize(): void {
    try {
      const cacheKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          cacheKeys.push(key);
        }
      }
      
      if (cacheKeys.length >= this.MAX_CACHE_SIZE) {
        // Remove oldest entries (this is a simple LRU approximation)
        const entriesToRemove = cacheKeys.length - this.MAX_CACHE_SIZE + 10; // Remove extra to avoid frequent cleanup
        
        // Sort by timestamp and remove oldest
        const entriesWithTimestamp = cacheKeys.map(key => {
          try {
            const cached = localStorage.getItem(key);
            const parsedCache = cached ? JSON.parse(cached) : null;
            return { key, timestamp: parsedCache?.timestamp || 0 };
          } catch {
            return { key, timestamp: 0 };
          }
        }).sort((a, b) => a.timestamp - b.timestamp);
        
        for (let i = 0; i < entriesToRemove; i++) {
          localStorage.removeItem(entriesWithTimestamp[i].key);
        }
        
        console.log(`🗑️ [BrowserCache] Removed ${entriesToRemove} old entries to maintain cache size`);
      }
    } catch (error) {
      console.warn('Error ensuring cache size:', error);
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(photoReference: string, maxWidth: number): string {
    return `${this.CACHE_PREFIX}${photoReference}:${maxWidth}`;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; totalSize: number; expired: number } {
    let size = 0;
    let totalSize = 0;
    let expired = 0;
    const now = Date.now();
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          size++;
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            try {
              const cached: BrowserCachedPhoto = JSON.parse(value);
              if (now - cached.timestamp > cached.ttl) {
                expired++;
              }
            } catch {
              expired++;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error getting cache stats:', error);
    }
    
    return { size, totalSize, expired };
  }

  /**
   * Clear all photo cache
   */
  clear(): void {
    try {
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ [BrowserCache] Cleared ${keysToDelete.length} entries`);
    } catch (error) {
      console.warn('Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const browserPhotoCache = BrowserPhotoCacheService.getInstance();

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  browserPhotoCache.cleanup();
}, 5 * 60 * 1000);