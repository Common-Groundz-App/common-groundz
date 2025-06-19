
interface PerformanceMetric {
  timestamp: number;
  userId: string;
  metricType: string;
  value: number;
  metadata?: Record<string, any>;
}

interface UserInteraction {
  timestamp: number;
  userId: string;
  interactionType: string;
  metadata?: Record<string, any>;
}

interface ComponentPerformance {
  componentName: string;
  renderTime: number;
  mountTime: number;
  updateCount: number;
  lastUpdate: number;
}

class PerformanceAnalyticsService {
  private metrics: PerformanceMetric[] = [];
  private interactions: UserInteraction[] = [];
  private componentMetrics = new Map<string, ComponentPerformance>();
  private isMonitoring = false;
  private batchSize = 50;
  private flushInterval = 30000; // 30 seconds

  // Start performance monitoring
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('📊 Performance monitoring started');

    // Monitor memory usage
    this.startMemoryMonitoring();
    
    // Monitor network performance
    this.startNetworkMonitoring();
    
    // Batch flush metrics periodically
    setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);

    // Monitor Core Web Vitals
    this.monitorCoreWebVitals();
  }

  // Stop performance monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    this.flushMetrics();
    console.log('📊 Performance monitoring stopped');
  }

  // Track page view with performance metrics
  trackPageView(route: string, userId: string) {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigationEntry) {
      this.addMetric({
        timestamp: Date.now(),
        userId,
        metricType: 'page_load_time',
        value: navigationEntry.loadEventEnd - navigationEntry.navigationStart,
        metadata: { route }
      });

      this.addMetric({
        timestamp: Date.now(),
        userId,
        metricType: 'dom_content_loaded',
        value: navigationEntry.domContentLoadedEventEnd - navigationEntry.navigationStart,
        metadata: { route }
      });
    }
  }

  // Track user interactions
  trackUserInteraction(interactionType: string, metadata?: Record<string, any>) {
    this.interactions.push({
      timestamp: Date.now(),
      userId: metadata?.userId || 'unknown',
      interactionType,
      metadata
    });

    // Track interaction timing
    if (metadata?.userId) {
      this.addMetric({
        timestamp: Date.now(),
        userId: metadata.userId,
        metricType: 'user_interaction',
        value: 1,
        metadata: { interactionType, ...metadata }
      });
    }
  }

  // Track component performance
  trackComponentPerformance(componentName: string, renderTime: number, isMount: boolean = false) {
    const existing = this.componentMetrics.get(componentName);
    
    if (existing) {
      existing.renderTime = (existing.renderTime + renderTime) / 2; // Average
      existing.updateCount++;
      existing.lastUpdate = Date.now();
      if (isMount) existing.mountTime = renderTime;
    } else {
      this.componentMetrics.set(componentName, {
        componentName,
        renderTime,
        mountTime: isMount ? renderTime : 0,
        updateCount: 1,
        lastUpdate: Date.now()
      });
    }

    // Add to metrics for batching
    this.addMetric({
      timestamp: Date.now(),
      userId: 'system',
      metricType: 'component_performance',
      value: renderTime,
      metadata: { componentName, isMount }
    });
  }

  // Track API performance
  trackAPIPerformance(endpoint: string, duration: number, status: number, userId: string) {
    this.addMetric({
      timestamp: Date.now(),
      userId,
      metricType: 'api_performance',
      value: duration,
      metadata: { endpoint, status }
    });
  }

  // Monitor memory usage
  private startMemoryMonitoring() {
    if (!('memory' in (performance as any))) return;

    const checkMemory = () => {
      const memInfo = (performance as any).memory;
      
      this.addMetric({
        timestamp: Date.now(),
        userId: 'system',
        metricType: 'memory_usage',
        value: memInfo.usedJSHeapSize / 1024 / 1024, // MB
        metadata: {
          totalHeapSize: memInfo.totalJSHeapSize / 1024 / 1024,
          heapLimit: memInfo.jsHeapSizeLimit / 1024 / 1024
        }
      });
    };

    // Check memory every 30 seconds
    setInterval(checkMemory, 30000);
    checkMemory(); // Initial check
  }

  // Monitor network performance
  private startNetworkMonitoring() {
    if (!('connection' in navigator)) return;

    const connection = (navigator as any).connection;
    
    this.addMetric({
      timestamp: Date.now(),
      userId: 'system',
      metricType: 'network_info',
      value: connection.downlink || 0,
      metadata: {
        effectiveType: connection.effectiveType,
        rtt: connection.rtt,
        saveData: connection.saveData
      }
    });

    // Listen for connection changes
    connection.addEventListener('change', () => {
      this.addMetric({
        timestamp: Date.now(),
        userId: 'system',
        metricType: 'network_change',
        value: connection.downlink || 0,
        metadata: {
          effectiveType: connection.effectiveType,
          rtt: connection.rtt
        }
      });
    });
  }

  // Monitor Core Web Vitals
  private monitorCoreWebVitals() {
    // First Contentful Paint
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          this.addMetric({
            timestamp: Date.now(),
            userId: 'system',
            metricType: 'first_contentful_paint',
            value: entry.startTime,
            metadata: { name: entry.name }
          });
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['paint'] });
    } catch (e) {
      console.warn('Paint timing not supported');
    }

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.addMetric({
          timestamp: Date.now(),
          userId: 'system',
          metricType: 'largest_contentful_paint',
          value: lastEntry.startTime,
          metadata: { element: lastEntry.element?.tagName }
        });
      });

      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP not supported');
    }
  }

  // Add metric to batch
  private addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Auto-flush if batch is full
    if (this.metrics.length >= this.batchSize) {
      this.flushMetrics();
    }
  }

  // Flush metrics (send to analytics service)
  private flushMetrics() {
    if (this.metrics.length === 0 && this.interactions.length === 0) return;

    // In a real app, you'd send these to your analytics service
    console.log(`📊 Flushing ${this.metrics.length} metrics and ${this.interactions.length} interactions`);
    
    // Log performance summary
    this.logPerformanceSummary();
    
    // Clear batches
    this.metrics = [];
    this.interactions = [];
  }

  // Log performance summary
  private logPerformanceSummary() {
    const summary = {
      totalMetrics: this.metrics.length,
      totalInteractions: this.interactions.length,
      componentMetrics: Array.from(this.componentMetrics.values()),
      averageRenderTime: this.getAverageRenderTime(),
      memoryUsage: this.getLatestMemoryUsage(),
      timestamp: Date.now()
    };

    console.log('📊 Performance Summary:', summary);
  }

  // Get average render time across components
  private getAverageRenderTime(): number {
    const renderTimes = Array.from(this.componentMetrics.values()).map(m => m.renderTime);
    if (renderTimes.length === 0) return 0;
    return renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
  }

  // Get latest memory usage
  private getLatestMemoryUsage(): number {
    const memoryMetrics = this.metrics.filter(m => m.metricType === 'memory_usage');
    if (memoryMetrics.length === 0) return 0;
    return memoryMetrics[memoryMetrics.length - 1].value;
  }

  // Get performance analytics for dashboard
  getPerformanceAnalytics() {
    return {
      componentMetrics: Array.from(this.componentMetrics.values()),
      totalMetrics: this.metrics.length,
      totalInteractions: this.interactions.length,
      averageRenderTime: this.getAverageRenderTime(),
      memoryUsage: this.getLatestMemoryUsage(),
      isMonitoring: this.isMonitoring
    };
  }

  // Get user behavior patterns
  getUserBehaviorPatterns(userId: string) {
    const userInteractions = this.interactions.filter(i => i.userId === userId);
    const userMetrics = this.metrics.filter(m => m.userId === userId);

    return {
      totalInteractions: userInteractions.length,
      interactionTypes: [...new Set(userInteractions.map(i => i.interactionType))],
      averageSessionTime: this.calculateAverageSessionTime(userInteractions),
      performanceMetrics: userMetrics
    };
  }

  // Calculate average session time for user
  private calculateAverageSessionTime(interactions: UserInteraction[]): number {
    if (interactions.length < 2) return 0;
    
    const firstInteraction = Math.min(...interactions.map(i => i.timestamp));
    const lastInteraction = Math.max(...interactions.map(i => i.timestamp));
    
    return lastInteraction - firstInteraction;
  }
}

export const performanceAnalyticsService = new PerformanceAnalyticsService();

// Auto-start monitoring in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  performanceAnalyticsService.startMonitoring();
}
