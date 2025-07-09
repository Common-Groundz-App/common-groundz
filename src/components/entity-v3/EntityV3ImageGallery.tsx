
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MediaItem } from '@/types/media';

interface EntityV3ImageGalleryProps {
  primaryImage: string;
  entityType: string;
  entityName: string;
  media?: MediaItem[];
  className?: string;
}

export const EntityV3ImageGallery: React.FC<EntityV3ImageGalleryProps> = ({
  primaryImage,
  entityType,
  entityName,
  media = [],
  className
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Combine primary image with media items
  const allImages = [
    { url: primaryImage, alt: entityName },
    ...media.filter(item => item.type === 'image').map(item => ({
      url: item.url,
      alt: item.alt || item.caption || entityName
    }))
  ];

  const displayImages = allImages.slice(0, 5); // Limit to 5 images
  const hasMultipleImages = displayImages.length > 1;

  const openModal = (index: number) => {
    setSelectedImageIndex(index);
    setIsModalOpen(true);
  };

  const navigateModal = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedImageIndex(prev => prev === 0 ? displayImages.length - 1 : prev - 1);
    } else {
      setSelectedImageIndex(prev => prev === displayImages.length - 1 ? 0 : prev + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') navigateModal('prev');
    if (e.key === 'ArrowRight') navigateModal('next');
    if (e.key === 'Escape') setIsModalOpen(false);
  };

  return (
    <>
      <div className={cn("relative rounded-lg overflow-hidden bg-muted", className)}>
        {hasMultipleImages ? (
          // Multi-image grid layout (Airbnb style)
          <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[300px] md:h-[400px]">
            {/* Main large image */}
            <div 
              className="col-span-2 row-span-2 relative group cursor-pointer"
              onClick={() => openModal(0)}
            >
              <ImageWithFallback
                src={displayImages[0].url}
                alt={displayImages[0].alt}
                entityType={entityType}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                suppressConsoleErrors
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Thumbnail grid */}
            {displayImages.slice(1, 5).map((image, index) => (
              <div
                key={index + 1}
                className="relative group cursor-pointer"
                onClick={() => openModal(index + 1)}
              >
                <ImageWithFallback
                  src={image.url}
                  alt={image.alt}
                  entityType={entityType}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  suppressConsoleErrors
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {index === 3 && allImages.length > 5 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-semibold">
                    +{allImages.length - 5}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Single image layout
          <div 
            className="aspect-square relative group cursor-pointer"
            onClick={() => openModal(0)}
          >
            <ImageWithFallback
              src={displayImages[0]?.url || ''}
              alt={displayImages[0]?.alt || entityName}
              entityType={entityType}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              suppressConsoleErrors
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent 
          className="max-w-5xl h-[90vh] p-0 bg-black/95"
          onKeyDown={handleKeyDown}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={() => setIsModalOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Navigation buttons */}
            {displayImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-10 text-white hover:bg-white/20"
                  onClick={() => navigateModal('prev')}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-10 text-white hover:bg-white/20"
                  onClick={() => navigateModal('next')}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Main image */}
            <ImageWithFallback
              src={displayImages[selectedImageIndex]?.url || ''}
              alt={displayImages[selectedImageIndex]?.alt || entityName}
              entityType={entityType}
              className="max-w-full max-h-full object-contain"
              suppressConsoleErrors
            />

            {/* Image counter */}
            {displayImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                {selectedImageIndex + 1} / {displayImages.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
