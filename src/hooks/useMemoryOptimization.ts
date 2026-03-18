
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
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoryCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Self-rescheduling setTimeout pattern with visibility guard
  useEffect(() => {
    const scheduleCleanup = () => {
      cleanupTimerRef.current = setTimeout(() => {
        if (document.hidden) {
          scheduleCleanup();
          return;
        }
        performCleanup();
        scheduleCleanup();
      }, cleanupInterval);
    };

    const scheduleMemoryCheck = () => {
      memoryCheckTimerRef.current = setTimeout(() => {
        if (document.hidden) {
          scheduleMemoryCheck();
          return;
        }
        checkMemoryUsage();
        scheduleMemoryCheck();
      }, cleanupInterval / 2);
    };

    scheduleCleanup();
    scheduleMemoryCheck();

    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      if (memoryCheckTimerRef.current) {
        clearTimeout(memoryCheckTimerRef.current);
        memoryCheckTimerRef.current = null;
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
