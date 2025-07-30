import React, { useState } from 'react';
import { X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';

interface SimpleMediaGridProps {
  media: MediaItem[];
  onRemove: (media: MediaItem) => void;
}

export const SimpleMediaGrid: React.FC<SimpleMediaGridProps> = ({ media, onRemove }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % media.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {media.map((item, index) => (
          <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
            {/* Remove button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1 right-1 z-10 bg-black/50 hover:bg-black/70 text-white p-1 h-auto w-auto"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item);
              }}
            >
              <X className="w-3 h-3" />
            </Button>

            {/* Media preview */}
            <div 
              className="w-full h-full cursor-pointer"
              onClick={() => openLightbox(index)}
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.alt || 'Media'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-6 h-6 text-white" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <PhotoLightbox
          photos={media}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={nextImage}
          onPrevious={prevImage}
        />
      )}
    </>
  );
};