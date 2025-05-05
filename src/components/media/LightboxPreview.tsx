
import React, { useState, useEffect } from 'react';
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
  
  // Reset loaded state when media changes
  useEffect(() => {
    setLoaded({});
  }, [media]);
  
  const handleImageLoad = (id: string) => {
    setLoaded(prev => ({...prev, [id]: true}));
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
  const isLoaded = loaded[currentItem.id || currentIndex.toString()];
  
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
            <img 
              src={currentItem.url} 
              alt={currentItem.alt || currentItem.caption || `Image ${currentIndex + 1}`}
              className={cn(
                "max-h-[90vh] max-w-full object-contain transition-opacity duration-300",
                isLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => handleImageLoad(currentItem.id || currentIndex.toString())}
            />
          ) : (
            <video 
              src={currentItem.url} 
              poster={currentItem.thumbnail_url}
              controls
              className="max-h-[90vh] max-w-full object-contain"
              onLoadedData={() => handleImageLoad(currentItem.id || currentIndex.toString())}
            />
          )}
          
          {/* Loading indicator */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-white" />
            </div>
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
                  {media.map((_, idx) => (
                    <button
                      key={idx}
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
    </div>
  );
}
