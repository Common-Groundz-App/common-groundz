
interface ImagePerformanceMetric {
  timestamp: number;
  operation: string;
  entityId?: string;
  imageUrl?: string;
  success: boolean;
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface ProxyPerformanceMetric {
  timestamp: number;
  proxyType: string;
  originalUrl: string;
  proxyUrl: string;
  success: boolean;
  duration: number;
  responseSize?: number;
  cacheHit?: boolean;
  error?: string;
}

interface StorageMetric {
  timestamp: number;
  operation: 'upload' | 'download' | 'delete';
  entityId: string;
  fileSize?: number;
  success: boolean;
  duration: number;
  error?: string;
}

class ImagePerformanceService {
  private imageMetrics: ImagePerformanceMetric[] = [];
  private proxyMetrics: ProxyPerformanceMetric[] = [];
  private storageMetrics: StorageMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  // Track image storage operations
  trackImageStorage(
    operation: string,
    entityId: string,
    imageUrl: string,
    startTime: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ) {
    const metric: ImagePerformanceMetric = {
      timestamp: Date.now(),
      operation,
      entityId,
      imageUrl,
      success,
      duration: Date.now() - startTime,
      error,
      metadata
    };

    this.imageMetrics.push(metric);
    this.trimMetrics();

    // Log important metrics
    if (!success) {
      console.error(`[ImagePerformance] ${operation} failed for entity ${entityId}:`, error);
    } else {
      console.log(`[ImagePerformance] ${operation} completed in ${metric.duration}ms for entity ${entityId}`);
    }
  }

  // Track proxy performance
  trackProxyPerformance(
    proxyType: string,
    originalUrl: string,
    proxyUrl: string,
    startTime: number,
    success: boolean,
    responseSize?: number,
    cacheHit?: boolean,
    error?: string
  ) {
    const metric: ProxyPerformanceMetric = {
      timestamp: Date.now(),
      proxyType,
      originalUrl,
      proxyUrl,
      success,
      duration: Date.now() - startTime,
      responseSize,
      cacheHit,
      error
    };

    this.proxyMetrics.push(metric);
    this.trimMetrics();

    const cacheStatus = cacheHit ? '(cached)' : '(fresh)';
    if (!success) {
      console.error(`[ProxyPerformance] ${proxyType} proxy failed:`, error);
    } else {
      console.log(`[ProxyPerformance] ${proxyType} proxy completed in ${metric.duration}ms ${cacheStatus}`);
    }
  }

  // Track storage operations
  trackStorageOperation(
    operation: 'upload' | 'download' | 'delete',
    entityId: string,
    startTime: number,
    success: boolean,
    fileSize?: number,
    error?: string
  ) {
    const metric: StorageMetric = {
      timestamp: Date.now(),
      operation,
      entityId,
      fileSize,
      success,
      duration: Date.now() - startTime,
      error
    };

    this.storageMetrics.push(metric);
    this.trimMetrics();

    if (!success) {
      console.error(`[StoragePerformance] ${operation} failed for entity ${entityId}:`, error);
    } else {
      console.log(`[StoragePerformance] ${operation} completed in ${metric.duration}ms for entity ${entityId}`);
    }
  }

  // Get performance analytics
  getAnalytics() {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    const dayAgo = now - (24 * 60 * 60 * 1000);

    // Image storage analytics
    const recentImageMetrics = this.imageMetrics.filter(m => m.timestamp > hourAgo);
    const imageSuccessRate = this.calculateSuccessRate(recentImageMetrics);
    const avgImageDuration = this.calculateAverageDuration(recentImageMetrics);

    // Proxy analytics
    const recentProxyMetrics = this.proxyMetrics.filter(m => m.timestamp > hourAgo);
    const proxySuccessRate = this.calculateSuccessRate(recentProxyMetrics);
    const avgProxyDuration = this.calculateAverageDuration(recentProxyMetrics);
    const proxyCacheHitRate = this.calculateCacheHitRate(recentProxyMetrics);

    // Storage analytics
    const recentStorageMetrics = this.storageMetrics.filter(m => m.timestamp > hourAgo);
    const storageSuccessRate = this.calculateSuccessRate(recentStorageMetrics);
    const totalStorageSize = this.calculateTotalStorageSize(recentStorageMetrics);

    return {
      period: 'last_hour',
      imageStorage: {
        totalOperations: recentImageMetrics.length,
        successRate: imageSuccessRate,
        averageDuration: avgImageDuration,
        failures: recentImageMetrics.filter(m => !m.success).length
      },
      proxy: {
        totalRequests: recentProxyMetrics.length,
        successRate: proxySuccessRate,
        averageDuration: avgProxyDuration,
        cacheHitRate: proxyCacheHitRate,
        failures: recentProxyMetrics.filter(m => !m.success).length
      },
      storage: {
        totalOperations: recentStorageMetrics.length,
        successRate: storageSuccessRate,
        totalSizeMB: Math.round(totalStorageSize / (1024 * 1024) * 100) / 100,
        uploads: recentStorageMetrics.filter(m => m.operation === 'upload').length
      }
    };
  }

  // Get recent errors for debugging
  getRecentErrors(hours: number = 1) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    const imageErrors = this.imageMetrics
      .filter(m => !m.success && m.timestamp > cutoff)
      .map(m => ({ type: 'image', ...m }));
    
    const proxyErrors = this.proxyMetrics
      .filter(m => !m.success && m.timestamp > cutoff)
      .map(m => ({ type: 'proxy', ...m }));
    
    const storageErrors = this.storageMetrics
      .filter(m => !m.success && m.timestamp > cutoff)
      .map(m => ({ type: 'storage', ...m }));

    return [...imageErrors, ...proxyErrors, ...storageErrors]
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private calculateSuccessRate<T extends { success: boolean }>(metrics: T[]): number {
    if (metrics.length === 0) return 100;
    const successful = metrics.filter(m => m.success).length;
    return Math.round((successful / metrics.length) * 100);
  }

  private calculateAverageDuration<T extends { duration: number }>(metrics: T[]): number {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return Math.round(total / metrics.length);
  }

  private calculateCacheHitRate(metrics: ProxyPerformanceMetric[]): number {
    const metricsWithCache = metrics.filter(m => m.cacheHit !== undefined);
    if (metricsWithCache.length === 0) return 0;
    const hits = metricsWithCache.filter(m => m.cacheHit).length;
    return Math.round((hits / metricsWithCache.length) * 100);
  }

  private calculateTotalStorageSize(metrics: StorageMetric[]): number {
    return metrics
      .filter(m => m.operation === 'upload' && m.fileSize)
      .reduce((sum, m) => sum + (m.fileSize || 0), 0);
  }

  private trimMetrics() {
    if (this.imageMetrics.length > this.maxMetrics) {
      this.imageMetrics = this.imageMetrics.slice(-this.maxMetrics);
    }
    if (this.proxyMetrics.length > this.maxMetrics) {
      this.proxyMetrics = this.proxyMetrics.slice(-this.maxMetrics);
    }
    if (this.storageMetrics.length > this.maxMetrics) {
      this.storageMetrics = this.storageMetrics.slice(-this.maxMetrics);
    }
  }

  // Log performance summary periodically
  logPerformanceSummary() {
    const analytics = this.getAnalytics();
    console.log('📊 [Image Performance Summary]', analytics);
    
    const errors = this.getRecentErrors(1);
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} errors in the last hour:`, errors.slice(0, 5));
    }
  }
}

export const imagePerformanceService = new ImagePerformanceService();

// Auto-log performance summary every 15 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    imagePerformanceService.logPerformanceSummary();
  }, 15 * 60 * 1000);
}
