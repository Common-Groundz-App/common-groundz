
import React from 'react';
import { MediaItem } from '@/types/media';
import { MediaGallery } from '@/components/media/MediaGallery';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface PostMediaDisplayProps {
  media?: MediaItem[];
  className?: string;
  displayType?: 'grid' | 'carousel';
}

export function PostMediaDisplay({ 
  media, 
  className,
  displayType = 'grid'
}: PostMediaDisplayProps) {
  if (!media || media.length === 0 || media.every(m => m.is_deleted)) {
    return null;
  }
  
  if (displayType === 'carousel' && media.length > 1) {
    return (
      <Carousel className={className}>
        <CarouselContent>
          {media
            .filter(item => !item.is_deleted)
            .sort((a, b) => a.order - b.order)
            .map((item, index) => (
              <CarouselItem key={item.id || index}>
                <div className="p-1">
                  {item.type === 'image' ? (
                    <ImageWithFallback 
                      src={item.url} 
                      alt={item.alt || item.caption || `Media ${index + 1}`}
                      className="w-full h-64 object-contain rounded-md"
                    />
                  ) : (
                    <video 
                      src={item.url}
                      poster={item.thumbnail_url}
                      controls
                      className="w-full h-64 object-contain rounded-md"
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  {(item.caption || item.alt) && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      {item.caption || item.alt}
                    </div>
                  )}
                </div>
              </CarouselItem>
            ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
    );
  }
  
  // Default to grid display
  return (
    <MediaGallery 
      media={media} 
      editable={false}
      className={className}
    />
  );
}
