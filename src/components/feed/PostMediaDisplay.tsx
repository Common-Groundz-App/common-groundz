
import React from 'react';
import { MediaItem } from '@/types/media';
import { MediaGallery } from '@/components/media/MediaGallery';

interface PostMediaDisplayProps {
  media?: MediaItem[];
  className?: string;
}

export function PostMediaDisplay({ media, className }: PostMediaDisplayProps) {
  if (!media || media.length === 0 || media.every(m => m.is_deleted)) {
    return null;
  }
  
  return (
    <MediaGallery 
      media={media} 
      editable={false}
      className={className}
    />
  );
}
