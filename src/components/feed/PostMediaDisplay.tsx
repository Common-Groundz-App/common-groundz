
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
  maxHeight = 'h-80',
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
    .sort((a, b) => a.order - b.order);
    
  if (validMedia.length === 0) {
    return null;
  }
  
  // Use the TwitterStyleMediaPreview component for all media display
  return (
    <TwitterStyleMediaPreview
      media={validMedia}
      readOnly={true}
      className={cn("mt-3", className)}
      maxHeight={maxHeight}
      aspectRatio={aspectRatio}
      objectFit={objectFit}
      enableBackground={enableBackground}
      thumbnailDisplay={thumbnailDisplay}
      enableLazyLoading={enableLazyLoading}
    />
  );
}
