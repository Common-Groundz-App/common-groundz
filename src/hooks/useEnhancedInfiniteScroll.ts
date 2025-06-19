
import { useEffect, useRef, useCallback } from 'react';
import { usePerformanceMonitor } from './usePerformanceMonitor';

interface UseEnhancedInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => void;
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export const useEnhancedInfiniteScroll = ({
  hasMore,
  isLoading,
  loadMore,
  threshold = 300,
  rootMargin = '0px',
  enabled = true
}: UseEnhancedInfiniteScrollOptions) => {
  const { startRender, endRender } = usePerformanceMonitor('InfiniteScroll');
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>();
  const isLoadingRef = useRef(isLoading);

  // Update loading state ref
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      startRender();
      
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingRef.current && enabled) {
        loadMore();
      }
      
      endRender();
    },
    [hasMore, loadMore, enabled, startRender, endRender]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !enabled) return;

    // Disconnect existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer with performance optimizations
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold: 0.1,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, rootMargin, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { loadMoreRef };
};
