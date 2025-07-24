import React from 'react';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';

interface YelpStyleMediaPreviewProps {
  media: MediaItem[];
  onImageClick?: (index: number) => void;
  className?: string;
}

export function YelpStyleMediaPreview({ 
  media, 
  onImageClick, 
  className 
}: YelpStyleMediaPreviewProps) {
  if (!media || media.length === 0) {
    return null;
  }

  // Sort media by order
  const sortedMedia = [...media].sort((a, b) => (a.order || 0) - (b.order || 0));

  const renderMedia = (item: MediaItem, index: number) => {
    const isVideo = item.type === 'video';
    const src = item.thumbnail_url || item.url;

    return (
      <div
        key={item.id || index}
        className="relative cursor-pointer overflow-hidden rounded-md bg-muted"
        onClick={() => onImageClick?.(index)}
        style={getMediaStyle(sortedMedia.length, index)}
      >
        {isVideo ? (
          <video
            src={item.url}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
        ) : (
          <img
            src={src}
            alt={item.alt || `Media ${index + 1}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/50 p-2">
              <svg
                className="h-4 w-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Show count indicator on last image if there are more than 4 images */}
        {sortedMedia.length > 4 && index === 3 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-lg font-semibold text-white">
              +{sortedMedia.length - 4}
            </span>
          </div>
        )}
      </div>
    );
  };

  const getMediaStyle = (totalCount: number, index: number) => {
    if (totalCount === 1) {
      // Single image: max width constraint
      return {
        width: '280px',
        height: '180px',
        maxWidth: '100%'
      };
    }

    // Multiple images: calculate width based on count
    const maxWidth = 320; // Max container width for multiple images
    const gap = 2; // Gap between images in px
    const visibleCount = Math.min(totalCount, 4); // Show max 4 images
    const totalGaps = (visibleCount - 1) * gap;
    const imageWidth = (maxWidth - totalGaps) / visibleCount;

    return {
      width: `${imageWidth}px`,
      height: '120px', // Consistent height for all images in row
      marginRight: index < visibleCount - 1 ? `${gap}px` : '0'
    };
  };

  // Limit to first 4 images for display
  const displayMedia = sortedMedia.slice(0, 4);

  return (
    <div className={cn("flex items-center", className)}>
      {displayMedia.map((item, index) => renderMedia(item, index))}
    </div>
  );
}