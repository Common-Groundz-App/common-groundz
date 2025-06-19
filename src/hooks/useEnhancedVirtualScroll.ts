
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePerformanceMonitor } from './usePerformanceMonitor';
import { cacheService } from '@/services/cacheService';

interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  cacheKey?: string;
}

export const useEnhancedVirtualScroll = <T>(
  items: T[],
  options: VirtualScrollOptions
) => {
  const { itemHeight, containerHeight, overscan = 5, cacheKey } = options;
  const { startRender, endRender } = usePerformanceMonitor('VirtualScroll');
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const ticking = useRef(false);

  // Memoize calculations for performance
  const calculations = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
    
    return {
      visibleCount,
      totalHeight,
      startIndex,
      endIndex,
      offsetY: startIndex * itemHeight
    };
  }, [items.length, itemHeight, containerHeight, scrollTop, overscan]);

  const { visibleCount, totalHeight, startIndex, endIndex, offsetY } = calculations;

  // Memoize visible items
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
    }));
  }, [items, startIndex, endIndex]);

  // Optimized scroll handler with RAF
  const handleScroll = useCallback((e: Event) => {
    if (ticking.current) return;
    
    ticking.current = true;
    requestAnimationFrame(() => {
      startRender();
      
      const target = e.target as HTMLDivElement;
      const newScrollTop = target.scrollTop;
      
      // Only update if scroll position changed significantly
      if (Math.abs(newScrollTop - lastScrollTop.current) > itemHeight / 4) {
        setScrollTop(newScrollTop);
        lastScrollTop.current = newScrollTop;
        
        // Cache scroll position
        if (cacheKey) {
          cacheService.set(`scroll-${cacheKey}`, newScrollTop, 30000); // 30 seconds
        }
      }
      
      ticking.current = false;
      endRender();
    });
  }, [itemHeight, cacheKey, startRender, endRender]);

  // Restore scroll position from cache
  useEffect(() => {
    if (cacheKey && scrollElementRef.current) {
      const cachedScrollTop = cacheService.get<number>(`scroll-${cacheKey}`);
      if (cachedScrollTop !== null) {
        scrollElementRef.current.scrollTop = cachedScrollTop;
        setScrollTop(cachedScrollTop);
      }
    }
  }, [cacheKey]);

  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return {
    scrollElementRef,
    visibleItems,
    totalHeight,
    offsetY,
    visibleCount,
    startIndex,
    endIndex
  };
};
