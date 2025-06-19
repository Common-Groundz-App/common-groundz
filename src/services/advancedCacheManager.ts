
import { cacheService } from './cacheService';

interface CacheStrategy {
  ttl: number;
  refreshThreshold: number; // Percentage of TTL when to refresh
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[]; // Other cache keys this depends on
}

interface CacheMetrics {
  hits: number;
  misses: number;
  refreshes: number;
  lastAccessed: number;
  averageAccessTime: number;
}

class AdvancedCacheManager {
  private strategies = new Map<string, CacheStrategy>();
  private metrics = new Map<string, CacheMetrics>();
  private refreshPromises = new Map<string, Promise<any>>();
  private backgroundRefreshEnabled = true;

  constructor() {
    this.initializeDefaultStrategies();
    this.startBackgroundMaintenance();
  }

  // Initialize default caching strategies
  private initializeDefaultStrategies() {
    // User profiles - high priority, medium TTL
    this.setStrategy('user-profile-*', {
      ttl: 15 * 60 * 1000, // 15 minutes
      refreshThreshold: 0.7, // Refresh at 70% of TTL
      priority: 'high',
      dependencies: []
    });

    // Feed data - high priority, short TTL
    this.setStrategy('feed-*', {
      ttl: 5 * 60 * 1000, // 5 minutes
      refreshThreshold: 0.8, // Refresh at 80% of TTL
      priority: 'high',
      dependencies: ['user-behavior-*']
    });

    // Search results - medium priority, medium TTL
    this.setStrategy('search-*', {
      ttl: 10 * 60 * 1000, // 10 minutes
      refreshThreshold: 0.6,
      priority: 'medium',
      dependencies: []
    });

    // Entity data - low priority, long TTL
    this.setStrategy('entity-*', {
      ttl: 30 * 60 * 1000, // 30 minutes
      refreshThreshold: 0.5,
      priority: 'low',
      dependencies: []
    });

    // User behavior patterns - high priority, long TTL
    this.setStrategy('user-behavior-*', {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      refreshThreshold: 0.9,
      priority: 'high',
      dependencies: []
    });
  }

  // Set caching strategy for a pattern
  setStrategy(pattern: string, strategy: CacheStrategy) {
    this.strategies.set(pattern, strategy);
  }

  // Get strategy for a cache key
  private getStrategy(key: string): CacheStrategy | null {
    for (const [pattern, strategy] of this.strategies.entries()) {
      if (this.matchesPattern(key, pattern)) {
        return strategy;
      }
    }
    return null;
  }

  // Check if key matches pattern (simple wildcard support)
  private matchesPattern(key: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(key);
    }
    return key === pattern;
  }

  // Enhanced get with metrics and background refresh
  async get<T>(key: string, refreshFunction?: () => Promise<T>): Promise<T | null> {
    const startTime = performance.now();
    const strategy = this.getStrategy(key);
    
    // Update metrics
    this.updateMetrics(key, 'access', startTime);

    // Get from cache
    const cached = cacheService.get<T>(key);
    
    if (cached !== null) {
      this.updateMetrics(key, 'hit', startTime);
      
      // Check if we should background refresh
      if (strategy && refreshFunction) {
        await this.maybeBackgroundRefresh(key, strategy, refreshFunction);
      }
      
      return cached;
    }

    // Cache miss
    this.updateMetrics(key, 'miss', startTime);

    // Try to fetch if refresh function provided
    if (refreshFunction) {
      const data = await this.fetchWithDeduplication(key, refreshFunction);
      if (data !== null && strategy) {
        this.set(key, data, strategy.ttl);
      }
      return data;
    }

    return null;
  }

  // Enhanced set with strategy
  set<T>(key: string, data: T, customTtl?: number): void {
    const strategy = this.getStrategy(key);
    const ttl = customTtl || strategy?.ttl || 5 * 60 * 1000; // Default 5 minutes
    
    cacheService.set(key, data, ttl);
    
    // Initialize metrics if not exists
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        hits: 0,
        misses: 0,
        refreshes: 0,
        lastAccessed: Date.now(),
        averageAccessTime: 0
      });
    }
  }

  // Background refresh if needed
  private async maybeBackgroundRefresh<T>(
    key: string, 
    strategy: CacheStrategy, 
    refreshFunction: () => Promise<T>
  ) {
    if (!this.backgroundRefreshEnabled) return;

    // Check if we're in refresh threshold
    const item = (cacheService as any).cache.get(key);
    if (!item) return;

    const age = Date.now() - item.timestamp;
    const refreshTime = strategy.ttl * strategy.refreshThreshold;

    if (age >= refreshTime) {
      // Background refresh without blocking
      this.fetchWithDeduplication(key, refreshFunction)
        .then(data => {
          if (data !== null) {
            this.set(key, data, strategy.ttl);
            this.updateMetrics(key, 'refresh');
            console.log(`🔄 Background refreshed cache key: ${key}`);
          }
        })
        .catch(error => {
          console.warn(`Failed to background refresh ${key}:`, error);
        });
    }
  }

  // Fetch with deduplication to prevent multiple identical requests
  private async fetchWithDeduplication<T>(
    key: string, 
    refreshFunction: () => Promise<T>
  ): Promise<T | null> {
    // Check if we're already fetching this key
    if (this.refreshPromises.has(key)) {
      return this.refreshPromises.get(key)!;
    }

    // Create and store the promise
    const promise = refreshFunction()
      .finally(() => {
        // Remove from pending refreshes
        this.refreshPromises.delete(key);
      });

    this.refreshPromises.set(key, promise);
    
    try {
      return await promise;
    } catch (error) {
      console.error(`Failed to fetch data for key ${key}:`, error);
      return null;
    }
  }

  // Update cache metrics
  private updateMetrics(key: string, type: 'access' | 'hit' | 'miss' | 'refresh', startTime?: number) {
    let metrics = this.metrics.get(key);
    
    if (!metrics) {
      metrics = {
        hits: 0,
        misses: 0,
        refreshes: 0,
        lastAccessed: Date.now(),
        averageAccessTime: 0
      };
      this.metrics.set(key, metrics);
    }

    switch (type) {
      case 'hit':
        metrics.hits++;
        break;
      case 'miss':
        metrics.misses++;
        break;
      case 'refresh':
        metrics.refreshes++;
        break;
    }

    metrics.lastAccessed = Date.now();
    
    if (startTime) {
      const accessTime = performance.now() - startTime;
      metrics.averageAccessTime = (metrics.averageAccessTime + accessTime) / 2;
    }
  }

  // Invalidate cache by pattern
  invalidateByPattern(pattern: string) {
    const keys = this.getCacheKeys();
    let invalidatedCount = 0;

    for (const key of keys) {
      if (this.matchesPattern(key, pattern)) {
        cacheService.delete(key);
        this.metrics.delete(key);
        invalidatedCount++;
      }
    }

    console.log(`🗑️ Invalidated ${invalidatedCount} cache entries matching pattern: ${pattern}`);
    return invalidatedCount;
  }

  // Invalidate dependencies
  invalidateDependencies(changedKey: string) {
    let invalidatedCount = 0;

    for (const [pattern, strategy] of this.strategies.entries()) {
      if (strategy.dependencies) {
        for (const dep of strategy.dependencies) {
          if (this.matchesPattern(changedKey, dep)) {
            invalidatedCount += this.invalidateByPattern(pattern);
            break;
          }
        }
      }
    }

    if (invalidatedCount > 0) {
      console.log(`🔗 Invalidated ${invalidatedCount} dependent cache entries for: ${changedKey}`);
    }
  }

  // Get all cache keys (this would need to be implemented in cacheService)
  private getCacheKeys(): string[] {
    // This would need access to cacheService internal cache
    // For now, return empty array
    return [];
  }

  // Start background maintenance
  private startBackgroundMaintenance() {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.performMaintenance();
    }, 5 * 60 * 1000);
  }

  // Perform cache maintenance
  private performMaintenance() {
    // Clean up old metrics
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, metrics] of this.metrics.entries()) {
      if (now - metrics.lastAccessed > maxAge) {
        this.metrics.delete(key);
      }
    }

    // Clean up expired cache entries
    const cleanedCount = cacheService.cleanup();
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cache maintenance: cleaned ${cleanedCount} expired entries`);
    }
  }

  // Get cache analytics
  getCacheAnalytics() {
    const analytics = {
      totalKeys: this.metrics.size,
      totalHits: 0,
      totalMisses: 0,
      totalRefreshes: 0,
      hitRate: 0,
      strategiesCount: this.strategies.size,
      topPerformers: [] as any[],
      lowPerformers: [] as any[]
    };

    // Calculate totals
    for (const metrics of this.metrics.values()) {
      analytics.totalHits += metrics.hits;
      analytics.totalMisses += metrics.misses;
      analytics.totalRefreshes += metrics.refreshes;
    }

    // Calculate hit rate
    const totalRequests = analytics.totalHits + analytics.totalMisses;
    analytics.hitRate = totalRequests > 0 ? analytics.totalHits / totalRequests : 0;

    // Find top and low performers
    const sortedMetrics = Array.from(this.metrics.entries())
      .map(([key, metrics]) => ({
        key,
        hitRate: (metrics.hits + metrics.misses) > 0 ? metrics.hits / (metrics.hits + metrics.misses) : 0,
        totalRequests: metrics.hits + metrics.misses,
        averageAccessTime: metrics.averageAccessTime
      }))
      .sort((a, b) => b.hitRate - a.hitRate);

    analytics.topPerformers = sortedMetrics.slice(0, 5);
    analytics.lowPerformers = sortedMetrics.slice(-5).reverse();

    return analytics;
  }

  // Enable/disable background refresh
  setBackgroundRefresh(enabled: boolean) {
    this.backgroundRefreshEnabled = enabled;
    console.log(`🔄 Background refresh ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Warm cache with commonly accessed data
  async warmCache(userId: string) {
    console.log(`🔥 Warming cache for user: ${userId}`);
    
    // This would typically warm up commonly accessed data
    // Implementation depends on your specific use case
    
    // Example: Pre-load user profile
    const userProfileKey = `user-profile-${userId}`;
    if (!cacheService.has(userProfileKey)) {
      // Would call actual user profile service
      console.log(`🔥 Would warm user profile cache for ${userId}`);
    }
  }
}

export const advancedCacheManager = new AdvancedCacheManager();
