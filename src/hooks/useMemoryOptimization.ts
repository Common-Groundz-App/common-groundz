
import { useEffect, useRef, useCallback } from 'react';
import { usePerformanceMonitor } from './usePerformanceMonitor';

interface MemoryOptimizationOptions {
  cleanupInterval?: number;
  maxMemoryUsage?: number;
  componentName: string;
}

export const useMemoryOptimization = ({
  cleanupInterval = 30000, // 30 seconds
  maxMemoryUsage = 50, // 50MB
  componentName
}: MemoryOptimizationOptions) => {
  const { startRender, endRender } = usePerformanceMonitor(componentName);
  const cleanupTimerRef = useRef<NodeJS.Timeout>();
  const memoryCheckRef = useRef<NodeJS.Timeout>();

  // Memory cleanup function
  const performCleanup = useCallback(() => {
    startRender();
    
    // Force garbage collection if available (Chrome DevTools)
    if ('gc' in window && typeof window.gc === 'function') {
      window.gc();
    }
    
    // Clear unnecessary caches
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('temp-') || cacheName.includes('old-')) {
            caches.delete(cacheName);
          }
        });
      });
    }
    
    endRender();
  }, [componentName, startRender, endRender]);

  // Memory monitoring
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in (performance as any)) {
      const memInfo = (performance as any).memory;
      const usedMB = memInfo.usedJSHeapSize / 1024 / 1024;
      
      if (usedMB > maxMemoryUsage) {
        console.warn(`High memory usage detected: ${usedMB.toFixed(2)}MB in ${componentName}`);
        performCleanup();
      }
    }
  }, [maxMemoryUsage, componentName, performCleanup]);

  // Set up cleanup intervals
  useEffect(() => {
    cleanupTimerRef.current = setInterval(performCleanup, cleanupInterval);
    memoryCheckRef.current = setInterval(checkMemoryUsage, cleanupInterval / 2);

    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
      if (memoryCheckRef.current) {
        clearInterval(memoryCheckRef.current);
      }
    };
  }, [cleanupInterval, performCleanup, checkMemoryUsage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      performCleanup();
    };
  }, [performCleanup]);

  return {
    performCleanup,
    checkMemoryUsage
  };
};
