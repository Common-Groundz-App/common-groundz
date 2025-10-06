
import React, { useState } from 'react';
import { MediaItem } from '@/types/media';
import { X, ZoomIn, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LightboxPreview } from './LightboxPreview';
import { useIsMobile } from '@/hooks/use-mobile';

interface CompactMediaGridProps {
  media: MediaItem[];
  onRemove?: (media: MediaItem) => void;
  className?: string;
  maxVisible?: number;
  onOpenLightbox?: (index: number) => void;
  primaryMediaUrl?: string | null;
  onSetPrimary?: (url: string) => void;
}

export function CompactMediaGrid({
  media,
  onRemove,
  className,
  maxVisible = 4,
  onOpenLightbox,
  primaryMediaUrl,
  onSetPrimary
}: CompactMediaGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const isMobile = useIsMobile();
  
  if (media.length === 0) return null;
  
  // Sort media by order field
  const sortedMedia = [...media].sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Only show up to maxVisible items in the grid
  const visibleMedia = sortedMedia.slice(0, maxVisible);
  const hasMore = media.length > maxVisible;
  
  const handleOpenLightbox = (index: number) => {
    if (onOpenLightbox) {
      // Use parent's lightbox handler if provided
      onOpenLightbox(index);
    } else {
      // Fallback to internal lightbox state
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };
  
  return (
    <>
      <div className={cn(
        "flex overflow-x-auto gap-2 pb-2 snap-x snap-mandatory compact-media-grid",
        "scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-muted-foreground/20",
        className
      )}>
        {visibleMedia.map((item, index) => (
          <div 
            key={item.id || item.url}
            className={cn(
              "group relative shrink-0 h-24 w-24 bg-muted rounded-md overflow-hidden",
              "snap-start cursor-pointer transition-transform hover:scale-105",
              "border border-muted-foreground/20 lightbox-trigger"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLightbox(index);
            }}
          >
            {/* Media thumbnail */}
            {item.type === 'image' ? (
              <img 
                src={item.thumbnail_url || item.url} 
                alt={item.caption || item.alt || `Image ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <video 
                src={item.url} 
                className="h-full w-full object-cover"
                muted
                poster={item.thumbnail_url}
              />
            )}
            
            {/* Primary badge */}
            {primaryMediaUrl === item.url && (
              <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1 z-10">
                <Star className="h-3 w-3 fill-current" />
                Primary
              </div>
            )}

            {/* Hover actions overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {/* Zoom indicator */}
              <ZoomIn className="text-white" />
              
              {/* Set as Primary button */}
              {onSetPrimary && primaryMediaUrl !== item.url && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary(item.url);
                  }}
                  className="text-xs"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Set as Primary
                </Button>
              )}
            </div>
            
            {/* Remove button - show on hover or always on mobile */}
            {onRemove && (
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 hover:bg-black/80 text-white media-remove-button",
                  !isMobile && "opacity-0 group-hover:opacity-100 transition-opacity",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove(item);
                }}
              >
                <X size={12} />
                <span className="sr-only">Remove</span>
              </Button>
            )}
          </div>
        ))}
        
        {/* "More" indicator when media count exceeds maxVisible */}
        {hasMore && (
          <div 
            className="relative shrink-0 h-24 w-24 rounded-md bg-muted/50 flex items-center justify-center cursor-pointer lightbox-trigger"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLightbox(maxVisible);
            }}
          >
            <span className="text-sm font-medium text-muted-foreground">
              +{media.length - maxVisible} more
            </span>
          </div>
        )}
      </div>
      
      {/* Lightbox preview - only render if using internal lightbox state */}
      {!onOpenLightbox && lightboxOpen && (
        <LightboxPreview
          media={sortedMedia}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
