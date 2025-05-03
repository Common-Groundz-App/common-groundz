
import React from 'react';
import { MediaItem } from '@/types/media';
import { MediaGallery } from '@/components/media/MediaGallery';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { TwitterStyleMediaPreview } from '@/components/media/TwitterStyleMediaPreview';
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
  displayType?: 'grid' | 'carousel' | 'twitter';
}

export function PostMediaDisplay({ 
  media, 
  className,
  displayType = 'twitter'
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
  
  // Use the TwitterStyleMediaPreview component for twitter style display
  if (displayType === 'twitter') {
    return (
      <TwitterStyleMediaPreview
        media={validMedia}
        readOnly={true}
        className={className}
      />
    );
  }
  
  if (displayType === 'carousel' && media.length > 1) {
    return (
      <Carousel className={className}>
        <CarouselContent>
          {validMedia.map((item, index) => (
            <CarouselItem key={item.id || index}>
              <div className="p-1 flex items-center justify-center">
                {item.type === 'image' ? (
                  <ImageWithFallback 
                    src={item.url} 
                    alt={item.alt || item.caption || `Media ${index + 1}`}
                    className="max-w-full h-64 object-contain rounded-md"
                  />
                ) : (
                  <video 
                    src={item.url}
                    poster={item.thumbnail_url}
                    controls
                    className="max-w-full h-64 object-contain rounded-md"
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
      media={validMedia} 
      editable={false}
      className={className}
    />
  );
}
