
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { cacheService } from '@/services/cacheService';

interface EnhancedProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
  sizes?: string;
  quality?: number;
}

export const EnhancedProgressiveImage: React.FC<EnhancedProgressiveImageProps> = ({
  src,
  alt,
  className,
  placeholder,
  onLoad,
  onError,
  priority = false,
  sizes,
  quality = 75
}) => {
  const { startRender, endRender } = usePerformanceMonitor('ProgressiveImage');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver>();
  const loadStartTime = useRef<number>();

  // Check cache for already loaded images
  const cacheKey = `img-${src}`;
  const isCached = cacheService.has(cacheKey);

  useEffect(() => {
    if (isCached) {
      setIsLoaded(true);
      return;
    }

    const element = imgRef.current;
    if (!element || priority) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start loading 50px before coming into view
      }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [isCached, priority]);

  const handleLoad = useCallback(() => {
    startRender();
    
    if (loadStartTime.current) {
      const loadTime = Date.now() - loadStartTime.current;
      console.log(`Image loaded in ${loadTime}ms:`, src);
    }
    
    setIsLoaded(true);
    
    // Cache successful load
    cacheService.set(cacheKey, true, 300000); // 5 minutes
    
    onLoad?.();
    endRender();
  }, [src, cacheKey, onLoad, startRender, endRender]);

  const handleError = useCallback(() => {
    setIsError(true);
    onError?.();
  }, [onError]);

  // Start load timing when image src is set
  useEffect(() => {
    if (isInView && src && !isCached) {
      loadStartTime.current = Date.now();
    }
  }, [isInView, src, isCached]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Placeholder while loading */}
      {!isLoaded && !isError && (
        <div className="absolute inset-0 bg-muted animate-pulse">
          {placeholder && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Main image */}
      <img
        ref={imgRef}
        src={isInView ? src : undefined}
        alt={alt}
        className={cn(
          'transition-opacity duration-500 w-full h-full object-cover',
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading={priority ? 'eager' : 'lazy'}
        sizes={sizes}
        decoding="async"
      />
      
      {/* Error state */}
      {isError && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
};
