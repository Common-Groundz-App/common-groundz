
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TwitterStyleMediaPreviewProps {
  media: MediaItem[];
  onRemove?: (item: MediaItem) => void;
  className?: string;
  readOnly?: boolean;
}

export function TwitterStyleMediaPreview({
  media,
  onRemove,
  className,
  readOnly = false
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
  
  // Handle different layout strategies based on the number of images
  if (media.length === 1) {
    // Single image view
    return (
      <div 
        ref={containerRef}
        className={cn("relative mt-3 overflow-hidden rounded-xl", className)}
      >
        <div className="w-full h-80 relative bg-black/5">
          {media[0].type === 'image' ? (
            <img 
              src={media[0].url} 
              alt={media[0].alt || "Image"} 
              className="w-full h-full object-contain bg-black/5 rounded-xl"
            />
          ) : (
            <video 
              src={media[0].url} 
              poster={media[0].thumbnail_url}
              controls
              className="w-full h-full object-contain rounded-xl"
            />
          )}
          
          {/* Remove button for single image */}
          {!readOnly && onRemove && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white"
              onClick={() => onRemove(media[0])}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  if (media.length > 1) {
    return (
      <div 
        ref={containerRef} 
        className={cn(
          "relative mt-3 overflow-hidden rounded-xl",
          className
        )}
        onTouchStart={handleSwipe}
      >
        {/* Multiple images carousel view */}
        <div className="relative h-80 w-full bg-black/5 rounded-xl overflow-hidden">
          {/* Media items container */}
          <div className="h-full w-full">
            {media.map((item, index) => (
              <div 
                key={item.id || index}
                className={cn(
                  "absolute top-0 left-0 w-full h-full flex items-center justify-center transition-opacity duration-300",
                  currentIndex === index ? "opacity-100 z-10" : "opacity-0 z-0"
                )}
              >
                {item.type === 'image' ? (
                  <img 
                    src={item.url} 
                    alt={item.alt || item.caption || `Image ${index + 1}`} 
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <video 
                    src={item.url} 
                    poster={item.thumbnail_url}
                    controls
                    className="max-w-full max-h-full object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                
                {/* Remove button for each item */}
                {!readOnly && onRemove && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
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
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              {/* Image counter and navigation dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 items-center z-20">
                {media.map((_, idx) => (
                  <button 
                    key={idx} 
                    className={cn(
                      "h-2 rounded-full transition-all focus:outline-none",
                      idx === currentIndex ? "w-6 bg-white" : "w-2 bg-white/60"
                    )}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
                
                <span className="text-xs text-white bg-black/40 px-2 py-0.5 rounded-full ml-2">
                  {currentIndex + 1}/{media.length}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Grid preview for thumbnails navigation */}
        <div className={cn(
          "grid gap-1 mt-1 h-20",
          media.length === 2 ? "grid-cols-2" : 
          media.length === 3 ? "grid-cols-3" : 
          "grid-cols-4"
        )}>
          {media.map((item, index) => (
            <button
              key={item.id || index}
              className={cn(
                "h-full w-full relative rounded-md overflow-hidden",
                currentIndex === index ? "border-2 border-primary" : "border border-transparent opacity-70"
              )}
              onClick={() => setCurrentIndex(index)}
            >
              {item.type === 'image' ? (
                <img 
                  src={item.url} 
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-black/10 flex items-center justify-center">
                  <span className="text-xs">Video</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }
  
  return null;
}
