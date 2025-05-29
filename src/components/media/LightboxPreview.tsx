import React, { useState, useEffect, useRef } from 'react';
import { MediaItem } from '@/types/media';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface LightboxPreviewProps {
  media: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
  className?: string;
}

export function LightboxPreview({ 
  media,
  initialIndex = 0,
  onClose,
  className 
}: LightboxPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const mediaRef = useRef<MediaItem[]>([]);
  const isMobile = useIsMobile();
  
  // Prevent body scrolling when lightbox is open
  useEffect(() => {
    // Save the current overflow value
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    // Cleanup function to restore original styles
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = '';
    };
  }, []);
  
  // Track if the media array has changed
  useEffect(() => {
    const mediaChanged = 
      mediaRef.current.length !== media.length || 
      mediaRef.current.some((item, idx) => item.url !== media[idx]?.url);
    
    // Only reset loaded state if media array changed
    if (mediaChanged) {
      setLoaded({});
      mediaRef.current = [...media];
    }
  }, [media]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Preload adjacent images
  const preloadAdjacentImages = () => {
    if (!media || media.length <= 1) return;
    
    // Preload next image
    const nextIdx = (currentIndex + 1) % media.length;
    const nextItem = media[nextIdx];
    if (nextItem?.type === 'image' && !loaded[getImageKey(nextItem, nextIdx)]) {
      const nextImg = new Image();
      nextImg.src = nextItem.url;
      nextImg.onload = () => handleImagePreload(nextItem, nextIdx);
    }
    
    // Preload previous image
    const prevIdx = (currentIndex - 1 + media.length) % media.length;
    const prevItem = media[prevIdx];
    if (prevItem?.type === 'image' && !loaded[getImageKey(prevItem, prevIdx)]) {
      const prevImg = new Image();
      prevImg.src = prevItem.url;
      prevImg.onload = () => handleImagePreload(prevItem, prevIdx);
    }
  };
  
  // Get a stable key for the image
  const getImageKey = (item: MediaItem, index: number): string => {
    return item.id || `${item.url}-${index}`;
  };
  
  const handleImageLoad = (item: MediaItem, index: number) => {
    const key = getImageKey(item, index);
    if (!loaded[key]) {
      setLoaded(prev => ({...prev, [key]: true}));
    }
    
    // Start preloading adjacent images once current image is loaded
    preloadAdjacentImages();
  };
  
  const handleImagePreload = (item: MediaItem, index: number) => {
    const key = getImageKey(item, index);
    setLoaded(prev => ({...prev, [key]: true}));
  };
  
  const nextImage = () => {
    setCurrentIndex(prev => (prev + 1) % media.length);
  };
  
  const prevImage = () => {
    setCurrentIndex(prev => (prev - 1 + media.length) % media.length);
  };
  
  if (!media || media.length === 0) {
    return null;
  }
  
  const currentItem = media[currentIndex];
  const imageKey = getImageKey(currentItem, currentIndex);
  const isLoaded = loaded[imageKey];
  
  // Determine orientation class for responsive styling
  const getOrientationClass = (item: MediaItem) => {
    if (!item.orientation && item.width && item.height) {
      const ratio = item.width / item.height;
      if (ratio > 1.05) return 'landscape';
      if (ratio < 0.95) return 'portrait';
      return 'square';
    }
    return item.orientation || 'landscape';
  };
  
  const orientation = getOrientationClass(currentItem);
  const isLandscape = orientation === 'landscape';
  
  return (
    <div className={cn("fixed inset-0 z-[9999] flex items-center justify-center bg-black/95", className)}>
      {/* Close button - smaller on mobile */}
      <Button 
        className={cn(
          "absolute right-4 z-50 rounded-full bg-gray-800/70 hover:bg-gray-700",
          isMobile ? "right-2 top-2 h-8 w-8" : "right-4 top-4 h-10 w-10"
        )}
        size="icon"
        variant="ghost"
        onClick={onClose}
      >
        <X className={cn("text-white", isMobile ? "h-5 w-5" : "h-6 w-6")} />
        <span className="sr-only">Close</span>
      </Button>
      
      {/* Main image container - reduced padding on mobile */}
      <div className={cn(
        "relative flex h-full w-full items-center justify-center",
        isMobile ? "px-2" : "px-12"
      )}>
        {/* Current media item */}
        <div className="relative flex h-full max-h-[90vh] w-full items-center justify-center">
          {currentItem.type === 'image' ? (
            <>
              <img 
                key={imageKey}
                src={currentItem.url} 
                alt={currentItem.alt || currentItem.caption || `Image ${currentIndex + 1}`}
                className={cn(
                  "transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0",
                  // Orientation-specific styles
                  isMobile && isLandscape 
                    ? "h-auto w-full object-contain"
                    : "max-h-[90vh] max-w-full object-contain"
                )}
                style={isMobile && isLandscape ? { maxHeight: '85vh' } : undefined}
                onLoad={() => handleImageLoad(currentItem, currentIndex)}
              />
              {/* Only show loading spinner if the image hasn't loaded yet */}
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-white" />
                </div>
              )}
            </>
          ) : (
            <video 
              key={imageKey}
              src={currentItem.url} 
              poster={currentItem.thumbnail_url}
              controls
              className={cn(
                isMobile && isLandscape 
                  ? "h-auto w-full object-contain" 
                  : "max-h-[90vh] max-w-full object-contain"
              )}
              onLoadedData={() => handleImageLoad(currentItem, currentIndex)}
            />
          )}
        </div>
        
        {/* Navigation controls - only shown when there are multiple items */}
        {media.length > 1 && (
          <>
            {/* Previous button - smaller on mobile */}
            <Button
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full bg-gray-800/70 hover:bg-gray-700",
                isMobile 
                  ? "left-1 h-8 w-8" 
                  : "left-4 h-12 w-12"
              )}
              size="icon"
              variant="ghost"
              onClick={prevImage}
            >
              <ChevronLeft className={cn("text-white", isMobile ? "h-5 w-5" : "h-8 w-8")} />
              <span className="sr-only">Previous image</span>
            </Button>
            
            {/* Next button - smaller on mobile */}
            <Button
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full bg-gray-800/70 hover:bg-gray-700",
                isMobile 
                  ? "right-1 h-8 w-8" 
                  : "right-4 h-12 w-12"
              )}
              size="icon"
              variant="ghost"
              onClick={nextImage}
            >
              <ChevronRight className={cn("text-white", isMobile ? "h-5 w-5" : "h-8 w-8")} />
              <span className="sr-only">Next image</span>
            </Button>
            
            {/* Image counter - more compact on mobile */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <div className={cn(
                "flex items-center gap-2",
                isMobile && "scale-90"
              )}>
                {/* Navigation dots - simplified on mobile */}
                <div className={cn("flex gap-2", isMobile && "gap-1")}>
                  {media.map((item, idx) => (
                    <button
                      key={getImageKey(item, idx)}
                      className={cn(
                        "h-2 rounded-full transition-all focus:outline-none",
                        idx === currentIndex 
                          ? isMobile ? "w-6 bg-brand-orange" : "w-8 bg-brand-orange"
                          : "w-2 bg-white opacity-70 hover:opacity-100"
                      )}
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
                
                {/* Image counter text - more compact on mobile */}
                <span className={cn(
                  "ml-4 rounded-full bg-black/60 px-3 py-1 text-white",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {currentIndex + 1} / {media.length}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invisible preloader for adjacent images */}
      <div className="sr-only hidden">
        {media.map((item, idx) => {
          // Only preload images not currently shown
          if (item.type === 'image' && idx !== currentIndex) {
            return (
              <img 
                key={`preload-${getImageKey(item, idx)}`}
                src={item.url}
                alt=""
                onLoad={() => handleImagePreload(item, idx)}
                aria-hidden="true"
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
