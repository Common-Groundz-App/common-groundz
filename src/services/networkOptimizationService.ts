
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  priority?: 'high' | 'medium' | 'low';
  batchable?: boolean;
}

interface BatchedRequest extends RequestOptions {
  id: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

interface NetworkMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  retryCount: number;
  batchedRequests: number;
}

class NetworkOptimizationService {
  private pendingRequests = new Map<string, Promise<any>>();
  private batchQueue: BatchedRequest[] = [];
  private metrics: NetworkMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    retryCount: 0,
    batchedRequests: 0
  };
  
  private batchTimeout = 100; // 100ms batch window
  private maxBatchSize = 10;
  private batchTimer: NodeJS.Timeout | null = null;
  private connectionType: string = 'unknown';
  private isSlowConnection = false;

  constructor() {
    this.detectConnectionType();
    this.setupConnectionMonitoring();
  }

  // Detect connection type and adapt behavior
  private detectConnectionType() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.connectionType = connection.effectiveType || 'unknown';
      this.isSlowConnection = ['slow-2g', '2g'].includes(this.connectionType);
      
      console.log(`🌐 Connection detected: ${this.connectionType}, slow: ${this.isSlowConnection}`);
    }
  }

  // Monitor connection changes
  private setupConnectionMonitoring() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      connection.addEventListener('change', () => {
        this.detectConnectionType();
        this.adaptToConnection();
      });
    }
  }

  // Adapt behavior based on connection
  private adaptToConnection() {
    if (this.isSlowConnection) {
      this.batchTimeout = 200; // Longer batch window for slow connections
      this.maxBatchSize = 5; // Smaller batches
      console.log('🐌 Adapted to slow connection');
    } else {
      this.batchTimeout = 100; // Default batch window
      this.maxBatchSize = 10; // Default batch size
      console.log('🚀 Adapted to fast connection');
    }
  }

  // Optimized request with deduplication, retry, and batching
  async request<T>(options: RequestOptions): Promise<T> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    // Generate request key for deduplication
    const requestKey = this.generateRequestKey(options);

    // Check for duplicate requests
    if (this.pendingRequests.has(requestKey)) {
      console.log(`🔄 Deduplicating request: ${requestKey}`);
      return this.pendingRequests.get(requestKey)!;
    }

    // Check if request can be batched
    if (options.batchable && options.method === 'GET') {
      return this.handleBatchableRequest<T>(options, requestKey, startTime);
    }

    // Execute single request with retry logic
    const requestPromise = this.executeRequestWithRetry<T>(options, startTime);
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      this.updateMetrics(true, startTime);
      return result;
    } catch (error) {
      this.updateMetrics(false, startTime);
      throw error;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  // Handle batchable requests
  private handleBatchableRequest<T>(
    options: RequestOptions, 
    requestKey: string, 
    startTime: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const batchedRequest: BatchedRequest = {
        ...options,
        id: requestKey,
        resolve,
        reject,
        timestamp: startTime
      };

      this.batchQueue.push(batchedRequest);

      // Set up batch processing timer
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.batchTimeout);
      }

      // Process immediately if batch is full
      if (this.batchQueue.length >= this.maxBatchSize) {
        this.processBatch();
      }
    });
  }

  // Process batched requests
  private async processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    this.metrics.batchedRequests += batch.length;

    console.log(`📦 Processing batch of ${batch.length} requests`);

    // Group by similar endpoints for better batching
    const grouped = this.groupBatchRequests(batch);

    for (const group of grouped) {
      await this.executeBatchGroup(group);
    }
  }

  // Group batch requests by similar characteristics
  private groupBatchRequests(batch: BatchedRequest[]): BatchedRequest[][] {
    const groups: BatchedRequest[][] = [];
    const maxGroupSize = 5;

    // Simple grouping by URL base (could be more sophisticated)
    const urlGroups = new Map<string, BatchedRequest[]>();

    for (const request of batch) {
      const urlBase = new URL(request.url).pathname.split('/')[1] || 'default';
      
      if (!urlGroups.has(urlBase)) {
        urlGroups.set(urlBase, []);
      }

      const group = urlGroups.get(urlBase)!;
      if (group.length < maxGroupSize) {
        group.push(request);
      } else {
        groups.push([request]); // Create new group
      }
    }

    // Add all groups to result
    groups.push(...Array.from(urlGroups.values()).filter(g => g.length > 0));

    return groups;
  }

  // Execute a group of batched requests
  private async executeBatchGroup(group: BatchedRequest[]) {
    // Execute requests in parallel with concurrency limit
    const concurrencyLimit = this.isSlowConnection ? 2 : 4;
    const chunks = this.chunkArray(group, concurrencyLimit);

    for (const chunk of chunks) {
      const promises = chunk.map(async (request) => {
        try {
          const result = await this.executeRequestWithRetry(request, request.timestamp);
          request.resolve(result);
          this.updateMetrics(true, request.timestamp);
        } catch (error) {
          request.reject(error);
          this.updateMetrics(false, request.timestamp);
        }
      });

      await Promise.allSettled(promises);
    }
  }

  // Execute request with retry logic
  private async executeRequestWithRetry<T>(
    options: RequestOptions, 
    startTime: number,
    attempt: number = 1
  ): Promise<T> {
    const maxRetries = options.retries || (this.isSlowConnection ? 2 : 3);
    const timeout = options.timeout || (this.isSlowConnection ? 15000 : 10000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: controller.signal
      };

      if (options.body && options.method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(options.url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.warn(`Request attempt ${attempt} failed:`, error);

      // Retry logic with exponential backoff
      if (attempt < maxRetries) {
        this.metrics.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
        
        console.log(`⏳ Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await this.delay(delay);
        
        return this.executeRequestWithRetry<T>(options, startTime, attempt + 1);
      }

      throw error;
    }
  }

  // Generate unique key for request deduplication
  private generateRequestKey(options: RequestOptions): string {
    const key = `${options.method || 'GET'}-${options.url}`;
    
    if (options.body) {
      const bodyHash = this.simpleHash(JSON.stringify(options.body));
      return `${key}-${bodyHash}`;
    }
    
    return key;
  }

  // Simple hash function for request body
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Update metrics
  private updateMetrics(success: boolean, startTime: number) {
    const responseTime = performance.now() - startTime;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime + responseTime) / 2;
  }

  // Utility functions
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Get network metrics
  getNetworkMetrics(): NetworkMetrics & { connectionType: string; isSlowConnection: boolean } {
    return {
      ...this.metrics,
      connectionType: this.connectionType,
      isSlowConnection: this.isSlowConnection
    };
  }

  // Clear pending requests (useful for cleanup)
  clearPendingRequests() {
    this.pendingRequests.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Reject all batched requests
    for (const request of this.batchQueue) {
      request.reject(new Error('Request cancelled'));
    }
    this.batchQueue = [];
    
    console.log('🧹 Cleared all pending network requests');
  }

  // Force process any pending batches
  async flushBatches() {
    if (this.batchQueue.length > 0) {
      console.log(`⚡ Force flushing ${this.batchQueue.length} batched requests`);
      await this.processBatch();
    }
  }
}

export const networkOptimizationService = new NetworkOptimizationService();
