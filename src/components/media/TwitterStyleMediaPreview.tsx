
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  
  // Determine if we should show navigation elements
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
  
  // Enhanced swipe handling for mobile
  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!containerRef.current || media.length <= 1) return;
    
    setIsDragging(true);
    
    // Get the starting position
    if ('touches' in e) {
      setDragStartX(e.touches[0].clientX);
    } else {
      setDragStartX(e.clientX);
      
      // Add mouse event listeners for desktop dragging
      document.addEventListener('mousemove', handleSwipeMove);
      document.addEventListener('mouseup', handleSwipeEnd);
    }
  };
  
  const handleSwipeMove = (e: TouchEvent | MouseEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    
    // Calculate how far we've dragged
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = clientX - dragStartX;
    
    setDragDelta(delta);
  };
  
  const handleSwipeEnd = (e: TouchEvent | MouseEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Determine if the swipe was significant enough to change images
    const threshold = 50; // Minimum distance to trigger a swipe
    
    if (Math.abs(dragDelta) > threshold) {
      if (dragDelta > 0) {
        prevImage(); // Swipe right, go to previous image
      } else {
        nextImage(); // Swipe left, go to next image
      }
    }
    
    // Reset the drag delta
    setDragDelta(0);
    
    // Remove mouse event listeners
    document.removeEventListener('mousemove', handleSwipeMove);
    document.removeEventListener('mouseup', handleSwipeEnd);
  };
  
  // Set up touch event handlers
  useEffect(() => {
    const currentContainer = containerRef.current;
    
    if (currentContainer) {
      currentContainer.addEventListener('touchmove', handleSwipeMove, { passive: false });
      currentContainer.addEventListener('touchend', handleSwipeEnd);
    }
    
    return () => {
      if (currentContainer) {
        currentContainer.removeEventListener('touchmove', handleSwipeMove);
        currentContainer.removeEventListener('touchend', handleSwipeEnd);
      }
      
      // Also clean up any mouse event listeners
      document.removeEventListener('mousemove', handleSwipeMove);
      document.removeEventListener('mouseup', handleSwipeEnd);
    };
  }, [isDragging, dragStartX]);
  
  if (media.length === 0) return null;
  
  // Handle different layout strategies based on the number of images
  if (media.length === 1) {
    // Single image view
    return (
      <div 
        ref={containerRef}
        className={cn("relative mt-3 overflow-hidden rounded-xl", className)}
      >
        <div className="w-full h-80 relative bg-black/5 flex items-center justify-center">
          {media[0].type === 'image' ? (
            <img 
              src={media[0].url} 
              alt={media[0].alt || "Image"} 
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <video 
              src={media[0].url} 
              poster={media[0].thumbnail_url}
              controls
              className="max-w-full max-h-full object-contain"
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
        onTouchStart={handleSwipeStart}
        onMouseDown={handleSwipeStart}
      >
        {/* Multiple images carousel view */}
        <div className="relative h-80 w-full bg-black/5 rounded-xl overflow-hidden flex items-center justify-center">
          {/* Media items container */}
          <div className="h-full w-full relative overflow-x-hidden">
            {media.map((item, index) => (
              <div 
                key={item.id || index}
                className={cn(
                  "absolute top-0 left-0 w-full h-full flex items-center justify-center transition-all duration-300",
                  currentIndex === index ? "opacity-100 z-10" : "opacity-0 z-0",
                  isDragging && currentIndex === index && "transition-transform"
                )}
                style={
                  currentIndex === index && isDragging 
                    ? { transform: `translateX(${dragDelta}px)` } 
                    : undefined
                }
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
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-gray-800/60 hover:bg-gray-800 hover:scale-105 transition-all text-white z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-gray-800/60 hover:bg-gray-800 hover:scale-105 transition-all text-white z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
              
              {/* Image counter and navigation dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 items-center z-20">
                {media.map((_, idx) => (
                  <button 
                    key={idx} 
                    className={cn(
                      "h-2 rounded-full transition-all focus:outline-none",
                      idx === currentIndex 
                        ? "w-6 bg-brand-orange" 
                        : "w-2 bg-white opacity-70 hover:opacity-100"
                    )}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
                
                <span className="text-xs text-white bg-black/60 px-2 py-0.5 rounded-full ml-2">
                  {currentIndex + 1}/{media.length}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Grid preview for thumbnails navigation - with increased spacing */}
        <div className={cn(
          "grid gap-1 mt-3 h-20 overflow-x-hidden",
          media.length === 2 ? "grid-cols-2" : 
          media.length === 3 ? "grid-cols-3" : 
          "grid-cols-4"
        )}>
          {media.map((item, index) => (
            <button
              key={item.id || index}
              className={cn(
                "h-full w-full relative rounded-md overflow-hidden transition-all",
                currentIndex === index 
                  ? "border-2 border-brand-orange" 
                  : "border border-transparent opacity-70 hover:opacity-100"
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
