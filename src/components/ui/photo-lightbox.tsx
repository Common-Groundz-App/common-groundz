import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';

interface PhotoLightboxProps {
  photos: (MediaItem & { source?: string; username?: string; createdAt?: string })[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReport?: (photo: MediaItem & { source?: string; username?: string; createdAt?: string }) => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onReport
}) => {
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrevious();
          break;
        case 'ArrowRight':
          onNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, onNext, onPrevious]);

  if (!currentPhoto) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not child elements
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Navigation buttons */}
      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        </>
      )}

      {/* Report button */}
      {onReport && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReport(currentPhoto)}
          className="absolute top-4 right-16 text-white hover:bg-red-500/20 z-10"
        >
          <Flag className="w-5 h-5" />
        </Button>
      )}

      {/* Photo counter */}
      {photos.length > 1 && (
        <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      {/* Main media */}
      <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {currentPhoto.type === 'video' ? (
          <video
            src={currentPhoto.url}
            controls
            preload="metadata"
            className="max-w-full max-h-full object-contain cursor-auto"
            onClick={(e) => e.stopPropagation()}
            onPlay={(e) => e.stopPropagation()}
            onPause={(e) => e.stopPropagation()}
            onVolumeChange={(e) => e.stopPropagation()}
            onTimeUpdate={(e) => e.stopPropagation()}
            onSeeking={(e) => e.stopPropagation()}
            onSeeked={(e) => e.stopPropagation()}
            onLoadStart={(e) => e.stopPropagation()}
            onLoadedData={(e) => e.stopPropagation()}
            onLoadedMetadata={(e) => e.stopPropagation()}
            onCanPlay={(e) => e.stopPropagation()}
            onCanPlayThrough={(e) => e.stopPropagation()}
            onEnded={(e) => e.stopPropagation()}
            onError={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{ cursor: 'auto' }}
          />
        ) : (
          <img
            src={currentPhoto.url}
            alt={currentPhoto.alt || 'Photo'}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Photo metadata */}
      <div className={`absolute bg-black/50 text-white p-4 rounded-lg ${
        currentPhoto.type === 'video' 
          ? 'top-20 left-4 max-w-xs' 
          : 'bottom-4 left-4 right-4'
      }`}>
        <div className="flex justify-between items-start">
          <div>
            {currentPhoto.source === 'google_places' ? (
              <p className="text-sm">Photo from Google Places</p>
            ) : (
              <div>
                <p className="text-sm">
                  Photo by {currentPhoto.username || 'User'}
                </p>
                {currentPhoto.createdAt && (
                  <p className="text-xs text-gray-300">
                    {new Date(currentPhoto.createdAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};