import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TwitterStyleMediaPreviewProps {
  media: MediaItem[];
  onRemove?: (item: MediaItem) => void;
  className?: string;
  readOnly?: boolean;
  maxHeight?: string; 
  aspectRatio?: 'maintain' | '16:9' | '4:5' | '1:1';
  objectFit?: 'contain' | 'cover';
  enableBackground?: boolean;
  thumbnailDisplay?: 'always' | 'hover' | 'none';
  enableLazyLoading?: boolean;
}

export function TwitterStyleMediaPreview({
  media,
  onRemove,
  className,
  readOnly = false,
  maxHeight = 'h-80',
  aspectRatio = 'maintain',
  objectFit = 'contain',
  enableBackground = true,
  thumbnailDisplay = 'always',
  enableLazyLoading = true
}: TwitterStyleMediaPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(thumbnailDisplay === 'always');
  
  // Determine image orientation for the current image
  const getImageOrientation = (index: number): 'portrait' | 'landscape' | 'square' => {
    if (!media[index]) return 'landscape';
    
    // For simplicity, we're assuming square if we don't have dimension info
    if (!media[index].width || !media[index].height) return 'square';
    
    const ratio = media[index].width / media[index].height;
    if (ratio > 1.2) return 'landscape';
    if (ratio < 0.8) return 'portrait';
    return 'square';
  };
  
  const currentOrientation = getImageOrientation(currentIndex);
  
  // Handle image loaded event
  const handleImageLoad = (id: string) => {
    setLoaded(prev => ({...prev, [id]: true}));
  };
  
  // Determine if we should show navigation elements
  useEffect(() => {
    // Only show navigation arrows if we have multiple images
    setShowNavigation(media.length > 1);
    // Reset the current index if it's now out of bounds
    if (currentIndex >= media.length) {
      setCurrentIndex(Math.max(0, media.length - 1));
    }
    
    // Show thumbnails based on the prop
    if (thumbnailDisplay === 'always') {
      setShowThumbnails(true);
    } else if (thumbnailDisplay === 'none') {
      setShowThumbnails(false);
    }
  }, [media, currentIndex, thumbnailDisplay]);
  
  // Handle hover for thumbnails
  useEffect(() => {
    if (thumbnailDisplay === 'hover' && containerRef.current) {
      const handleMouseEnter = () => setShowThumbnails(true);
      const handleMouseLeave = () => setShowThumbnails(false);
      
      containerRef.current.addEventListener('mouseenter', handleMouseEnter);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('mouseenter', handleMouseEnter);
          containerRef.current.removeEventListener('mouseleave', handleMouseLeave);
        }
      };
    }
  }, [thumbnailDisplay]);
  
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
  
  // Set aspect ratio class based on the prop
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16:9': return 'aspect-video';
      case '4:5': return 'aspect-4/5';
      case '1:1': return 'aspect-square';
      default: return '';
    }
  };

  // Get background color based on orientation and enableBackground prop
  const getBackgroundColor = () => {
    if (!enableBackground) return '';
    
    // Use a lighter background for the image container
    return 'bg-gray-100 dark:bg-gray-800/30';
  };
  
  // Get width class based on orientation for portrait images
  const getWidthClass = () => {
    if (currentOrientation === 'portrait' && aspectRatio === 'maintain') {
      return 'max-w-[70%] mx-auto'; // Limit width for portrait images
    }
    return 'w-full';
  };

  // Single image view with enhanced styling
  if (media.length === 1) {
    const item = media[0];
    const isLoaded = loaded[item.id || '0'];
    
    return (
      <div 
        ref={containerRef}
        className={cn("relative mt-3 overflow-hidden rounded-xl", className)}
      >
        <div className={cn(
          "w-full relative flex items-center justify-center",
          getBackgroundColor(),
          maxHeight,
          getAspectRatioClass()
        )}>
          <div className={cn(
            "relative flex items-center justify-center",
            getWidthClass(),
            "h-full transition-all duration-200"
          )}>
            {/* Loading indicator */}
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            )}
            
            {item.type === 'image' ? (
              <img 
                src={item.url} 
                alt={item.alt || "Image"} 
                loading={enableLazyLoading ? "lazy" : "eager"}
                className={cn(
                  "max-w-full max-h-full transition-opacity duration-300", 
                  isLoaded ? "opacity-100" : "opacity-0",
                  objectFit === 'contain' ? "object-contain" : "object-cover"
                )}
                onLoad={() => handleImageLoad(item.id || '0')}
              />
            ) : (
              <video 
                src={item.url} 
                poster={item.thumbnail_url}
                controls
                className={cn(
                  "max-w-full max-h-full shadow-sm",
                  objectFit === 'contain' ? "object-contain" : "object-cover"
                )}
                onLoadedData={() => handleImageLoad(item.id || '0')}
              />
            )}
          </div>
          
          {/* Remove button for single image */}
          {!readOnly && onRemove && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white shadow-sm"
              onClick={() => onRemove(item)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  // Multiple images carousel view with enhanced styling
  if (media.length > 1) {
    const currentItem = media[currentIndex];
    const isLoaded = loaded[currentItem.id || currentIndex.toString()];
    
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
        <div className={cn(
          "relative w-full rounded-xl overflow-hidden flex items-center justify-center",
          getBackgroundColor(),
          maxHeight
        )}>
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
                <div className={cn(
                  "relative flex items-center justify-center",
                  getImageOrientation(index) === 'portrait' && aspectRatio === 'maintain' ? "max-w-[70%]" : "max-w-full",
                  "h-full transition-all duration-200"
                )}>
                  {/* Loading indicator */}
                  {currentIndex === index && !loaded[item.id || index.toString()] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
                    </div>
                  )}
                  
                  {item.type === 'image' ? (
                    <img 
                      src={item.url} 
                      alt={item.alt || item.caption || `Image ${index + 1}`} 
                      loading={enableLazyLoading ? "lazy" : "eager"}
                      className={cn(
                        "max-w-full max-h-full shadow-sm transition-opacity duration-300",
                        (currentIndex === index && loaded[item.id || index.toString()]) ? "opacity-100" : "opacity-0",
                        objectFit === 'contain' ? "object-contain" : "object-cover"
                      )}
                      onLoad={() => handleImageLoad(item.id || index.toString())}
                    />
                  ) : (
                    <video 
                      src={item.url} 
                      poster={item.thumbnail_url}
                      controls
                      className={cn(
                        "max-w-full max-h-full shadow-sm",
                        objectFit === 'contain' ? "object-contain" : "object-cover"
                      )}
                      onLoadedData={() => handleImageLoad(item.id || index.toString())}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
                
                {/* Remove button for each item */}
                {!readOnly && onRemove && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20 shadow-sm"
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
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-gray-800/60 hover:bg-gray-800 hover:scale-105 transition-all text-white z-20 shadow-md"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-gray-800/60 hover:bg-gray-800 hover:scale-105 transition-all text-white z-20 shadow-md"
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
                      "h-2 rounded-full transition-all focus:outline-none shadow-sm",
                      idx === currentIndex 
                        ? "w-6 bg-brand-orange" 
                        : "w-2 bg-white opacity-70 hover:opacity-100"
                    )}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
                
                <span className="text-xs text-white bg-black/60 px-2 py-0.5 rounded-full ml-2 shadow-sm">
                  {currentIndex + 1}/{media.length}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Grid preview for thumbnails navigation - with increased spacing */}
        {showThumbnails && media.length > 1 && (
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
                    ? "border-2 border-brand-orange shadow-md" 
                    : "border border-transparent opacity-70 hover:opacity-100"
                )}
                onClick={() => setCurrentIndex(index)}
              >
                {item.type === 'image' ? (
                  <img 
                    src={item.url} 
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-black/10 flex items-center justify-center">
                    <span className="text-xs">Video</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return null;
}
