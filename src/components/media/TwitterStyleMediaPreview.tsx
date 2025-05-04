import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { ChevronLeft, ChevronRight, X, Loader2, Maximize2, Images } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';

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
  displayMode?: 'grid' | 'carousel' | 'linkedin';
  onImageClick?: (index: number) => void;
  currentIndex?: number;
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
  enableLazyLoading = true,
  displayMode = 'grid',
  onImageClick,
  currentIndex = 0
}: TwitterStyleMediaPreviewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(currentIndex);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'carousel' | 'linkedin'>(displayMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [showThumbnails, setShowThumbnails] = useState(thumbnailDisplay === 'always');
  
  // Update currentImageIndex when currentIndex prop changes
  useEffect(() => {
    setCurrentImageIndex(currentIndex);
  }, [currentIndex]);
  
  // Update viewMode when displayMode prop changes
  useEffect(() => {
    setViewMode(displayMode);
  }, [displayMode]);
  
  // Enhanced orientation detection for better accuracy
  const determineOrientation = (mediaItem: MediaItem): 'portrait' | 'landscape' | 'square' => {
    // If the media item already has orientation defined, use it
    if (mediaItem.orientation) return mediaItem.orientation;
    
    // For simplicity, we're assuming landscape if we don't have dimension info
    if (!mediaItem.width || !mediaItem.height) return 'landscape';
    
    // More accurate ratio calculations with clearer thresholds
    const ratio = mediaItem.width / mediaItem.height;
    if (ratio > 1.1) return 'landscape';
    if (ratio < 0.9) return 'portrait';
    return 'square';
  };
  
  // Get orientation for the current media item
  const getCurrentOrientation = (): 'portrait' | 'landscape' | 'square' => {
    if (!media[currentImageIndex]) return 'landscape';
    return determineOrientation(media[currentImageIndex]);
  };
  
  // Get orientation for the first media item (for LinkedIn layout)
  const getFirstImageOrientation = (): 'portrait' | 'landscape' | 'square' => {
    if (!media[0]) return 'landscape';
    return determineOrientation(media[0]);
  };
  
  const currentOrientation = getCurrentOrientation();
  const firstImageOrientation = getFirstImageOrientation();
  
  // Handle image loaded event
  const handleImageLoad = (id: string) => {
    setLoaded(prev => ({...prev, [id]: true}));
  };
  
  // Determine if we should show navigation elements
  useEffect(() => {
    // Only show navigation arrows if we have multiple images and we're in carousel mode
    setShowNavigation(media.length > 1 && viewMode === 'carousel');
    // Reset the current index if it's now out of bounds
    if (currentImageIndex >= media.length) {
      setCurrentImageIndex(Math.max(0, media.length - 1));
    }
    
    // Show thumbnails based on the prop
    if (thumbnailDisplay === 'always') {
      setShowThumbnails(true);
    } else if (thumbnailDisplay === 'none') {
      setShowThumbnails(false);
    }
  }, [media, currentImageIndex, thumbnailDisplay, viewMode]);
  
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
    setCurrentImageIndex(prev => (prev + 1) % media.length);
  };
  
  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + media.length) % media.length);
  };
  
  const handleImageClick = (index: number) => {
    if (onImageClick) {
      onImageClick(index);
    } else {
      setCurrentImageIndex(index);
      setViewMode('carousel');
    }
  };
  
  // Enhanced swipe handling for mobile
  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!containerRef.current || media.length <= 1 || viewMode !== 'carousel') return;
    
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
    
    if (currentContainer && viewMode === 'carousel') {
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
  }, [isDragging, dragStartX, viewMode]);
  
  if (media.length === 0) return null;

  // Get dynamic styles based on orientation
  const getOrientationStyles = () => {
    // If using forced aspect ratio, return that
    if (aspectRatio !== 'maintain') {
      switch (aspectRatio) {
        case '16:9': return 'aspect-video';
        case '4:5': return 'aspect-4/5';
        case '1:1': return 'aspect-square';
      }
    }
    
    // Otherwise, use orientation-based styling
    switch (currentOrientation) {
      case 'portrait':
        return 'max-h-[600px] md:max-h-[800px]'; // Taller for portrait
      case 'landscape':
        return 'max-h-[400px] md:max-h-[500px]'; // Not as tall for landscape
      case 'square':
        return 'max-h-[400px] md:max-h-[600px]'; // Medium height for square
      default:
        return maxHeight; // Default to maxHeight prop
    }
  };

  // Get background color based on orientation and enableBackground prop
  const getBackgroundColor = () => {
    if (!enableBackground) return '';
    
    // Use a lighter background for the image container
    return 'bg-gray-100 dark:bg-gray-800/30';
  };
  
  // Enhanced single image view with better styling
  if (media.length === 1) {
    const item = media[0];
    const imageOrientation = determineOrientation(item);
    const isLoaded = loaded[item.id || '0'];
    
    return (
      <div 
        ref={containerRef}
        className={cn("relative mt-3 overflow-hidden rounded-xl", className)}
      >
        <div className={cn(
          "w-full relative flex items-center justify-center",
          getBackgroundColor(),
          getOrientationStyles(),
          "transition-all duration-300"
        )}>
          <div className={cn(
            "relative flex items-center justify-center h-full",
            imageOrientation === 'portrait' ? 'max-w-[80%] mx-auto' : 'w-full',
            "transition-all duration-200"
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
                  "max-w-full max-h-full rounded-md transition-opacity duration-300 shadow-sm", 
                  isLoaded ? "opacity-100" : "opacity-0",
                  objectFit === 'contain' ? "object-contain" : "object-cover"
                )}
                onLoad={() => handleImageLoad(item.id || '0')}
                onClick={() => onImageClick && onImageClick(0)}
              />
            ) : (
              <video 
                src={item.url} 
                poster={item.thumbnail_url}
                controls
                className={cn(
                  "max-w-full max-h-full rounded-md shadow-md",
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
  
  // Enhanced LinkedIn-style layout for multiple images
  if (media.length > 1 && viewMode === 'linkedin') {
    // Determine which LinkedIn layout to use based on first image orientation
    const getLinkedinLayoutClass = () => {
      // Force layout based on first image orientation
      return firstImageOrientation === 'portrait' ? 'linkedin-portrait-first' : 'linkedin-landscape-first';
    };

    // Log the orientation being used for debugging
    console.log('LinkedIn layout using orientation:', firstImageOrientation);

    return (
      <div 
        ref={containerRef}
        className={cn(
          "relative mt-3 overflow-hidden rounded-xl",
          className
        )}
      >
        <div className={cn(
          getLinkedinLayoutClass(),
          "max-h-[560px]"
        )}>
          {/* First image is always shown and takes prominence */}
          {media.length > 0 && (
            <div 
              className={cn(
                "relative overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800/30",
                "first-media-item"
              )}
              onClick={() => handleImageClick(0)}
            >
              {!loaded[media[0].id || '0'] && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
                </div>
              )}
              
              {media[0].type === 'image' ? (
                <img 
                  src={media[0].url} 
                  alt={media[0].alt || "Image 1"} 
                  loading={enableLazyLoading ? "lazy" : "eager"}
                  className={cn(
                    "w-full h-full transition-opacity duration-300",
                    firstImageOrientation === 'portrait' ? 'object-contain' : 'object-cover',
                    loaded[media[0].id || '0'] ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => handleImageLoad(media[0].id || '0')}
                />
              ) : (
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <Maximize2 className="h-6 w-6 text-white" />
                  </div>
                  <img 
                    src={media[0].thumbnail_url || media[0].url} 
                    alt={"Video thumbnail"}
                    className="w-full h-full object-cover"
                    onLoad={() => handleImageLoad(media[0].id || '0')}
                  />
                </div>
              )}
              
              {!readOnly && onRemove && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20 shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(media[0]);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          
          {/* Other images shown in a grid */}
          {media.slice(1, 4).map((item, index) => {
            const actualIndex = index + 1; // Actual index in the media array
            const isLoaded = loaded[item.id || actualIndex.toString()];
            
            // Determine if this is the last visible image for overlay purposes
            const isLastVisible = (firstImageOrientation === 'portrait' && actualIndex === 2) || 
                                 (firstImageOrientation !== 'portrait' && actualIndex === 3) || 
                                 actualIndex === media.length - 1;
                                 
            // Only show the "more" overlay if we have more than what's currently shown
            const hasMoreImages = media.length > (firstImageOrientation === 'portrait' ? 3 : 4);
            const showMoreOverlay = isLastVisible && hasMoreImages;
            
            return (
              <div 
                key={item.id || actualIndex} 
                className={cn(
                  "relative overflow-hidden cursor-pointer",
                  getBackgroundColor()
                )}
                onClick={() => handleImageClick(actualIndex)}
              >
                {/* Loading indicator */}
                {!isLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
                  </div>
                )}
                
                {item.type === 'image' ? (
                  <img 
                    src={item.url} 
                    alt={item.alt || `Image ${actualIndex + 1}`} 
                    loading={enableLazyLoading ? "lazy" : "eager"}
                    className={cn(
                      "w-full h-full transition-opacity duration-300",
                      isLoaded ? "opacity-100" : "opacity-0",
                      objectFit === 'cover' ? "object-cover" : "object-contain"
                    )}
                    onLoad={() => handleImageLoad(item.id || actualIndex.toString())}
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <Maximize2 className="h-6 w-6 text-white" />
                    </div>
                    <img 
                      src={item.thumbnail_url || item.url} 
                      alt={`Video thumbnail ${actualIndex + 1}`}
                      className="w-full h-full object-cover"
                      onLoad={() => handleImageLoad(item.id || actualIndex.toString())}
                    />
                  </div>
                )}
                
                {/* Enhanced "more" overlay with improved styling */}
                {showMoreOverlay && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center media-more-overlay">
                    <Images className="h-8 w-8 text-white mb-1" />
                    <span className="text-white font-medium text-lg">+{media.length - (firstImageOrientation === 'portrait' ? 3 : 4)}</span>
                    <span className="text-white/80 text-sm">more</span>
                  </div>
                )}
                
                {/* Remove button for each media item */}
                {!readOnly && onRemove && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  // Standard grid view for multiple images
  if (media.length > 1 && viewMode === 'grid') {
    // Get the appropriate grid class based on the number of media items
    const getGridClass = () => {
      switch (media.length) {
        case 2:
          return 'twitter-media-two';
        case 3:
          return 'twitter-media-three';
        case 4:
        default:
          return 'twitter-media-four'; // Use a 2x2 grid for 4 or more images
      }
    };
    
    return (
      <div 
        ref={containerRef}
        className={cn(
          "relative mt-3 overflow-hidden rounded-xl",
          className
        )}
      >
        <div className={cn(
          getGridClass(),
          "h-auto max-h-[500px]"
        )}>
          {media.slice(0, 4).map((item, index) => {
            const isLoaded = loaded[item.id || index.toString()];
            
            return (
              <div 
                key={item.id || index} 
                className={cn(
                  "relative overflow-hidden cursor-pointer",
                  getBackgroundColor()
                )}
                onClick={() => handleImageClick(index)}
              >
                {/* Loading indicator */}
                {!isLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
                  </div>
                )}
                
                {item.type === 'image' ? (
                  <img 
                    src={item.url} 
                    alt={item.alt || `Image ${index + 1}`} 
                    loading={enableLazyLoading ? "lazy" : "eager"}
                    className={cn(
                      "w-full h-full transition-opacity duration-300",
                      isLoaded ? "opacity-100" : "opacity-0",
                      objectFit === 'cover' ? "object-cover" : "object-contain"
                    )}
                    onLoad={() => handleImageLoad(item.id || index.toString())}
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <Maximize2 className="h-6 w-6 text-white" />
                    </div>
                    <img 
                      src={item.thumbnail_url || item.url} 
                      alt={`Video thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      onLoad={() => handleImageLoad(item.id || index.toString())}
                    />
                  </div>
                )}
                
                {/* Show +X more overlay on the 4th image if there are more than 4 images */}
                {index === 3 && media.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-medium text-xl">+{media.length - 4}</span>
                  </div>
                )}
                
                {/* Remove button for each media item */}
                {!readOnly && onRemove && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20 shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  // Enhanced carousel view for multiple images
  if (media.length > 1 && viewMode === 'carousel') {
    const currentItem = media[currentImageIndex];
    const isLoaded = loaded[currentItem.id || currentImageIndex.toString()];
    
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
          getOrientationStyles()
        )}>
          {/* Media items container */}
          <div className="h-full w-full relative overflow-x-hidden">
            {media.map((item, index) => {
              const itemOrientation = determineOrientation(item);
              return (
                <div 
                  key={item.id || index}
                  className={cn(
                    "absolute top-0 left-0 w-full h-full flex items-center justify-center transition-all duration-300",
                    currentImageIndex === index ? "opacity-100 z-10" : "opacity-0 z-0",
                    isDragging && currentImageIndex === index && "transition-transform"
                  )}
                  style={
                    currentImageIndex === index && isDragging 
                      ? { transform: `translateX(${dragDelta}px)` } 
                      : undefined
                  }
                >
                  <div className={cn(
                    "relative flex items-center justify-center h-full",
                    itemOrientation === 'portrait' ? 'max-w-[80%] mx-auto' : 'w-full',
                    "transition-all duration-200"
                  )}>
                    {/* Loading indicator */}
                    {currentImageIndex === index && !loaded[item.id || index.toString()] && (
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
                          "max-w-full max-h-full rounded-md shadow-sm transition-opacity duration-300",
                          (currentImageIndex === index && loaded[item.id || index.toString()]) ? "opacity-100" : "opacity-0",
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
                          "max-w-full max-h-full rounded-md shadow-md",
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
              );
            })}
          </div>
          
          {/* Back to grid button if we're in expanded view */}
          {onImageClick && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 left-2 h-8 w-8 rounded-full bg-gray-800/60 hover:bg-gray-800 text-white z-20 shadow-md"
              onClick={() => setViewMode('grid')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </Button>
          )}
          
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
                      idx === currentImageIndex 
                        ? "w-6 bg-brand-orange" 
                        : "w-2 bg-white opacity-70 hover:opacity-100"
                    )}
                    onClick={() => setCurrentImageIndex(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
                
                <span className="text-xs text-white bg-black/60 px-2 py-0.5 rounded-full ml-2 shadow-sm">
                  {currentImageIndex + 1}/{media.length}
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
                  currentImageIndex === index 
                    ? "border-2 border-brand-orange shadow-md" 
                    : "border border-transparent opacity-70 hover:opacity-100"
                )}
                onClick={() => setCurrentImageIndex(index)}
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
