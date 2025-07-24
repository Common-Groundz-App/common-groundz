
import React from 'react';
import { MediaItem } from '@/types/media';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TwitterStyleMediaPreviewProps {
  media: MediaItem[];
  onRemove?: (media: MediaItem) => void;
  onImageClick?: (index: number) => void;
  className?: string;
}

export function TwitterStyleMediaPreview({
  media,
  onRemove,
  onImageClick,
  className
}: TwitterStyleMediaPreviewProps) {
  const count = media.length;
  
  if (count === 0) return null;
  
  // Sort media by order field
  const sortedMedia = [...media].sort((a, b) => (a.order || 0) - (b.order || 0));

  const renderImage = (item: MediaItem, aspectRatio?: string, isFullWidth = false) => {
    const mediaIndex = sortedMedia.indexOf(item);
    return (
      <div 
        className={cn(
          "relative overflow-hidden rounded-lg bg-muted cursor-pointer", 
          aspectRatio || "aspect-square",
          isFullWidth && "col-span-2"
        )}
        key={item.id || item.url}
        onClick={() => onImageClick?.(mediaIndex)}
      >
        {item.type === 'image' ? (
          <img
            src={item.thumbnail_url || item.url}
            alt={item.caption || "Media item"}
            className="object-cover w-full h-full"
          />
        ) : (
          <video
            src={item.url}
            controls={false}
            muted
            className="object-cover w-full h-full"
          />
        )}
        
        {onRemove && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 hover:bg-black/80 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item);
            }}
          >
            <X size={14} />
            <span className="sr-only">Remove</span>
          </Button>
        )}
      </div>
    );
  };

  // Different layouts based on number of images
  switch (count) {
    case 1:
      // Detect orientation for better layout
      const item = sortedMedia[0];
      const isPortrait = item.orientation === 'portrait' || 
        (item.width && item.height && item.height > item.width);
      
      return (
        <div className={cn("w-full", className)}>
          {renderImage(item, isPortrait ? "aspect-[3/4]" : "aspect-[16/9]", true)}
        </div>
      );
      
    case 2:
      return (
        <div className={cn("grid grid-cols-2 gap-1", className)}>
          {sortedMedia.map(item => renderImage(item))}
        </div>
      );
      
    case 3:
      return (
        <div className={cn("grid grid-cols-2 gap-1", className)}>
          {/* First image takes full height */}
          <div className="h-full">
            {renderImage(sortedMedia[0], "aspect-[1/2]")}
          </div>
          {/* Second column has two images stacked */}
          <div className="grid grid-rows-2 gap-1">
            {renderImage(sortedMedia[1])}
            {renderImage(sortedMedia[2])}
          </div>
        </div>
      );
      
    case 4:
    default:
      // Grid of 4 or more images (only show first 4)
      return (
        <div className={cn("grid grid-cols-2 gap-1", className)}>
          {sortedMedia.slice(0, 4).map(item => renderImage(item))}
          
          {/* If there are more than 4 images, show a count */}
          {media.length > 4 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              +{media.length - 4} more
            </div>
          )}
        </div>
      );
  }
}
