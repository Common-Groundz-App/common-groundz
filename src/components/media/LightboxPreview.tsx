
import React, { useState, useEffect, useRef } from 'react';
import { MediaItem } from '@/types/media';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  
  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/95", className)}>
      {/* Close button */}
      <Button 
        className="absolute right-4 top-4 z-50 h-10 w-10 rounded-full bg-gray-800/70 hover:bg-gray-700"
        size="icon"
        variant="ghost"
        onClick={onClose}
      >
        <X className="h-6 w-6 text-white" />
        <span className="sr-only">Close</span>
      </Button>
      
      {/* Main image container */}
      <div className="relative flex h-full w-full items-center justify-center px-12">
        {/* Current media item */}
        <div className="relative flex h-full max-h-[90vh] w-full items-center justify-center">
          {currentItem.type === 'image' ? (
            <>
              <img 
                key={imageKey}
                src={currentItem.url} 
                alt={currentItem.alt || currentItem.caption || `Image ${currentIndex + 1}`}
                className={cn(
                  "max-h-[90vh] max-w-full object-contain transition-opacity duration-300",
                  isLoaded ? "opacity-100" : "opacity-0"
                )}
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
              className="max-h-[90vh] max-w-full object-contain"
              onLoadedData={() => handleImageLoad(currentItem, currentIndex)}
            />
          )}
        </div>
        
        {/* Navigation controls - only shown when there are multiple items */}
        {media.length > 1 && (
          <>
            {/* Previous button */}
            <Button
              className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-gray-800/70 hover:bg-gray-700"
              size="icon"
              variant="ghost"
              onClick={prevImage}
            >
              <ChevronLeft className="h-8 w-8 text-white" />
              <span className="sr-only">Previous image</span>
            </Button>
            
            {/* Next button */}
            <Button
              className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-gray-800/70 hover:bg-gray-700"
              size="icon"
              variant="ghost"
              onClick={nextImage}
            >
              <ChevronRight className="h-8 w-8 text-white" />
              <span className="sr-only">Next image</span>
            </Button>
            
            {/* Image counter */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-2">
                {/* Navigation dots */}
                <div className="flex gap-2">
                  {media.map((item, idx) => (
                    <button
                      key={getImageKey(item, idx)}
                      className={cn(
                        "h-2 rounded-full transition-all focus:outline-none",
                        idx === currentIndex 
                          ? "w-8 bg-brand-orange" 
                          : "w-2 bg-white opacity-70 hover:opacity-100"
                      )}
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
                
                {/* Image counter text */}
                <span className="ml-4 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
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
