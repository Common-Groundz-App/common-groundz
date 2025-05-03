
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TwitterStyleMediaPreviewProps {
  media: MediaItem[];
  onRemove: (item: MediaItem) => void;
  className?: string;
}

export function TwitterStyleMediaPreview({
  media,
  onRemove,
  className
}: TwitterStyleMediaPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  
  useEffect(() => {
    // Only show navigation arrows if we have multiple images
    setShowNavigation(media.length > 1);
    // Reset the current index if it's now out of bounds
    if (currentIndex >= media.length) {
      setCurrentIndex(Math.max(0, media.length - 1));
    }
  }, [media, currentIndex]);
  
  const nextImage = () => {
    setCurrentIndex(prev => (prev + 1) % media.length);
  };
  
  const prevImage = () => {
    setCurrentIndex(prev => (prev - 1 + media.length) % media.length);
  };
  
  const handleSwipe = (e: React.TouchEvent) => {
    if (!containerRef.current || media.length <= 1) return;
    
    const touchStart = e.touches[0].clientX;
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault();
    };
    
    const handleTouchEnd = (endEvent: TouchEvent) => {
      const touchEnd = endEvent.changedTouches[0].clientX;
      const diff = touchStart - touchEnd;
      
      if (Math.abs(diff) > 50) { // Minimum swipe distance
        if (diff > 0) {
          nextImage(); // Swipe left, go to next image
        } else {
          prevImage(); // Swipe right, go to previous image
        }
      }
      
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { once: true });
  };
  
  if (media.length === 0) return null;
  
  // Different layout strategies based on image count
  const getMediaLayout = () => {
    if (media.length === 1) {
      return "twitter-media-single";
    } else if (media.length === 2) {
      return "twitter-media-two";
    } else if (media.length === 3) {
      return "twitter-media-three";
    } else {
      return "twitter-media-four";
    }
  };
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative mt-3 overflow-hidden rounded-xl", 
        getMediaLayout(),
        className
      )}
      onTouchStart={handleSwipe}
    >
      {media.length > 1 ? (
        // Carousel view for multiple images
        <div className="relative h-80 w-full bg-black/5">
          <div 
            className="absolute inset-0 transition-transform duration-300 ease-in-out flex items-center justify-center"
            style={{ transform: `translateX(${-100 * currentIndex}%)` }}
          >
            {media.map((item, index) => (
              <div 
                key={item.id || index}
                className="min-w-full h-full flex-shrink-0 relative"
              >
                {item.type === 'image' ? (
                  <img 
                    src={item.url} 
                    alt={item.alt || `Image ${index + 1}`} 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video 
                    src={item.url} 
                    poster={item.thumbnail_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                )}
                
                {/* Remove button for each item */}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          {/* Navigation controls */}
          {showNavigation && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white"
                onClick={prevImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white"
                onClick={nextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              {/* Image counter and navigation dots */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 items-center">
                {media.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/60"
                    )}
                    onClick={() => setCurrentIndex(idx)}
                  />
                ))}
                <span className="text-xs text-white bg-black/40 px-2 py-0.5 rounded-full ml-2">
                  {currentIndex + 1}/{media.length}
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
        // Single image view
        <div className="w-full h-80 relative">
          {media[0].type === 'image' ? (
            <img 
              src={media[0].url} 
              alt={media[0].alt || "Image"} 
              className="w-full h-full object-contain bg-black/5"
            />
          ) : (
            <video 
              src={media[0].url} 
              poster={media[0].thumbnail_url}
              controls
              className="w-full h-full object-contain"
            />
          )}
          
          {/* Remove button for single image */}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white"
            onClick={() => onRemove(media[0])}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
