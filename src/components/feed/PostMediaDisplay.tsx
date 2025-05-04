
import React, { useState } from 'react';
import { MediaItem } from '@/types/media';
import { TwitterStyleMediaPreview } from '@/components/media/TwitterStyleMediaPreview';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface PostMediaDisplayProps {
  media?: MediaItem[];
  className?: string;
  displayType?: 'grid' | 'carousel' | 'linkedin';
  maxHeight?: string;
  aspectRatio?: 'maintain' | '16:9' | '4:5' | '1:1';
  objectFit?: 'contain' | 'cover';
  enableBackground?: boolean;
  thumbnailDisplay?: 'always' | 'hover' | 'none';
  enableLazyLoading?: boolean;
}

export function PostMediaDisplay({ 
  media, 
  className,
  displayType = 'linkedin',
  maxHeight,
  aspectRatio = 'maintain',
  objectFit = 'contain',
  enableBackground = true,
  thumbnailDisplay = 'always',
  enableLazyLoading = true
}: PostMediaDisplayProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  if (!media || media.length === 0 || media.every(m => m.is_deleted)) {
    return null;
  }
  
  // Filter out deleted media and sort by order
  const validMedia = media
    .filter(item => !item.is_deleted)
    .sort((a, b) => a.order - b.order)
    .map(item => {
      // Enhanced orientation detection - ensure each media item has accurate orientation
      if (!item.orientation && item.width && item.height) {
        const ratio = item.width / item.height;
        let orientation: 'portrait' | 'landscape' | 'square';
        
        // More precise thresholds for orientation detection
        if (ratio > 1.1) orientation = 'landscape';
        else if (ratio < 0.9) orientation = 'portrait';
        else orientation = 'square';
        
        return { ...item, orientation };
      } else if (!item.orientation) {
        // Default to landscape if we have no dimensions
        return { ...item, orientation: 'landscape' as const };
      }
      
      return item;
    });
    
  if (validMedia.length === 0) {
    return null;
  }
  
  // Determine appropriate maxHeight based on content and first image orientation
  const adaptiveMaxHeight = () => {
    if (maxHeight) return maxHeight;
    
    // Get first image orientation for better layout decisions
    const firstImageOrientation = validMedia[0].orientation || 'landscape';
    
    // Single image handling with orientation awareness
    if (validMedia.length === 1) {
      if (firstImageOrientation === 'portrait') return 'h-auto max-h-[600px]';
      if (firstImageOrientation === 'landscape') return 'h-auto max-h-[400px]';
      return 'h-auto max-h-[400px]'; // square
    }
    
    // Multiple images with LinkedIn layout - adjust based on first image orientation
    if (displayType === 'linkedin' && validMedia.length > 1) {
      if (firstImageOrientation === 'portrait') return 'h-auto max-h-[560px]'; // Taller for portrait first
      return 'h-auto max-h-[480px]'; // Standard height for landscape first
    }
    
    // Default for multiple images
    return 'h-auto max-h-[500px]';
  };
  
  const handleImageClick = (index: number) => {
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };
  
  return (
    <>
      <TwitterStyleMediaPreview
        media={validMedia}
        readOnly={true}
        className={cn("mt-3", className)}
        maxHeight={adaptiveMaxHeight()}
        aspectRatio={aspectRatio}
        objectFit={objectFit}
        enableBackground={enableBackground}
        thumbnailDisplay={thumbnailDisplay}
        enableLazyLoading={enableLazyLoading}
        displayMode={displayType}
        onImageClick={handleImageClick}
      />
      
      {/* Lightbox for full-screen image viewing */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-6xl w-full p-0 bg-transparent border-none shadow-none">
          <TwitterStyleMediaPreview
            media={validMedia}
            readOnly={true}
            displayMode="carousel"
            currentIndex={activeImageIndex}
            objectFit="contain"
            enableBackground={false}
            thumbnailDisplay="always"
            className="max-h-[90vh]"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
