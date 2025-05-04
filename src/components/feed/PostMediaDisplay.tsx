
import React from 'react';
import { MediaItem } from '@/types/media';
import { TwitterStyleMediaPreview } from '@/components/media/TwitterStyleMediaPreview';
import { cn } from '@/lib/utils';

interface PostMediaDisplayProps {
  media?: MediaItem[];
  className?: string;
  displayType?: 'grid' | 'carousel' | 'twitter';
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
  displayType = 'twitter',
  maxHeight,
  aspectRatio = 'maintain',
  objectFit = 'contain',
  enableBackground = true,
  thumbnailDisplay = 'always',
  enableLazyLoading = true
}: PostMediaDisplayProps) {
  if (!media || media.length === 0 || media.every(m => m.is_deleted)) {
    return null;
  }
  
  // Filter out deleted media and sort by order
  const validMedia = media
    .filter(item => !item.is_deleted)
    .sort((a, b) => a.order - b.order)
    .map(item => {
      // Ensure each media item has an orientation
      if (!item.orientation && item.width && item.height) {
        const ratio = item.width / item.height;
        let orientation: 'portrait' | 'landscape' | 'square';
        
        if (ratio > 1.2) orientation = 'landscape';
        else if (ratio < 0.8) orientation = 'portrait';
        else orientation = 'square';
        
        return { ...item, orientation };
      }
      
      return item;
    });
    
  if (validMedia.length === 0) {
    return null;
  }
  
  // Determine appropriate maxHeight based on content
  const adaptiveMaxHeight = () => {
    if (maxHeight) return maxHeight;
    
    // Single image handling
    if (validMedia.length === 1) {
      const item = validMedia[0];
      if (item.orientation === 'portrait') return 'h-auto max-h-[600px]';
      if (item.orientation === 'landscape') return 'h-auto max-h-[400px]';
      return 'h-auto max-h-[400px]'; // square
    }
    
    // Multiple images are limited to a standard height
    return 'h-auto max-h-[500px]';
  };
  
  // Use the TwitterStyleMediaPreview component for all media display
  return (
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
    />
  );
}
