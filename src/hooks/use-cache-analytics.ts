
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

interface CacheMetrics {
  totalQueries: number;
  staleQueries: number;
  fetchingQueries: number;
  cacheHitRate: number;
  memoryUsage: number;
}

export const useCacheAnalytics = () => {
  const queryClient = useQueryClient();
  const [metrics, setMetrics] = useState<CacheMetrics>({
    totalQueries: 0,
    staleQueries: 0,
    fetchingQueries: 0,
    cacheHitRate: 0,
    memoryUsage: 0
  });

  const calculateMetrics = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const totalQueries = queries.length;
    const staleQueries = queries.filter(q => q.isStale()).length;
    const fetchingQueries = queries.filter(q => q.isFetching()).length;
    
    // Estimate cache hit rate based on successful cached queries
    const cachedQueries = queries.filter(q => q.state.data && !q.isStale()).length;
    const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;
    
    // Rough memory usage estimation
    const memoryUsage = queries.reduce((acc, query) => {
      if (query.state.data) {
        try {
          return acc + JSON.stringify(query.state.data).length;
        } catch {
          return acc + 1000; // Fallback estimate
        }
      }
      return acc;
    }, 0);

    setMetrics({
      totalQueries,
      staleQueries,
      fetchingQueries,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      memoryUsage: Math.round(memoryUsage / 1024) // Convert to KB
    });
  };

  useEffect(() => {
    calculateMetrics();
    const interval = setInterval(calculateMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [queryClient]);

  const clearCache = () => {
    queryClient.clear();
    console.log('🗑️ Cache cleared');
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries();
    console.log('🔄 All queries invalidated');
  };

  const getCacheStats = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const statsByType = queries.reduce((acc, query) => {
      const key = query.queryKey[0] as string;
      if (!acc[key]) {
        acc[key] = { count: 0, stale: 0, fetching: 0 };
      }
      acc[key].count++;
      if (query.isStale()) acc[key].stale++;
      if (query.isFetching()) acc[key].fetching++;
      return acc;
    }, {} as Record<string, { count: number; stale: number; fetching: number }>);

    return statsByType;
  };

  return {
    metrics,
    clearCache,
    invalidateAll,
    getCacheStats,
    refreshMetrics: calculateMetrics
  };
};

// Development helper for cache debugging
export const useCacheDebugger = () => {
  const queryClient = useQueryClient();

  const logCacheState = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    console.group('🔍 Cache Debug Info');
    console.log('Total queries:', queries.length);
    
    queries.forEach(query => {
      console.log({
        key: query.queryKey,
        state: query.state.status,
        isStale: query.isStale(),
        isFetching: query.isFetching(),
        dataUpdatedAt: new Date(query.state.dataUpdatedAt),
        hasData: !!query.state.data
      });
    });
    
    console.groupEnd();
  };

  const findQuery = (partialKey: string) => {
    const cache = queryClient.getQueryCache();
    return cache.findAll().filter(query => 
      query.queryKey.some(k => 
        typeof k === 'string' && k.includes(partialKey)
      )
    );
  };

  return {
    logCacheState,
    findQuery
  };
};
