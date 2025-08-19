import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Flag, MoreVertical, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { EntityPhoto } from '@/services/entityPhotoService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PhotoLightboxProps {
  photos: (MediaItem & { source?: string; username?: string; createdAt?: string })[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReport?: (photo: MediaItem & { source?: string; username?: string; createdAt?: string }) => void;
  onBackToGallery?: () => void;
  source?: 'direct' | 'gallery';
  user?: any;
  entityPhotos?: EntityPhoto[];
  onEditPhoto?: (photo: MediaItem & { source?: string; username?: string; createdAt?: string }) => void;
  onDeletePhoto?: (photo: MediaItem & { source?: string; username?: string; createdAt?: string }) => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onReport,
  onBackToGallery,
  source = 'direct',
  user,
  entityPhotos = [],
  onEditPhoto,
  onDeletePhoto
}) => {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const mediaRef = useRef<(MediaItem & { source?: string; username?: string; createdAt?: string })[]>([]);
  const isMobile = useIsMobile();

  const currentPhoto = photos[currentIndex];

  // Prevent body scrolling when lightbox is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = '';
    };
  }, []);

  // Track if the media array has changed
  useEffect(() => {
    const mediaChanged = 
      mediaRef.current.length !== photos.length || 
      mediaRef.current.some((item, idx) => item.url !== photos[idx]?.url);
    
    if (mediaChanged) {
      setLoaded({});
      mediaRef.current = [...photos];
    }
  }, [photos]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onPrevious();
      } else if (e.key === 'ArrowRight') {
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  // Get a stable key for the image
  const getImageKey = (item: MediaItem, index: number): string => {
    return item.id || `${item.url}-${index}`;
  };

  const handleImageLoad = (item: MediaItem, index: number) => {
    const key = getImageKey(item, index);
    if (!loaded[key]) {
      setLoaded(prev => ({...prev, [key]: true}));
    }
  };

  // Photo management handlers
  const isOwner = useCallback((photo: MediaItem & { source?: string; username?: string; createdAt?: string }): boolean => {
    return photo.source === 'entity_photo' && 
           user && 
           entityPhotos.some(ep => ep.id === photo.id && ep.user_id === user.id);
  }, [user, entityPhotos]);

  if (!currentPhoto) return null;

  // Ensure modal root exists
  let modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    modalRoot.style.position = 'relative';
    modalRoot.style.zIndex = '9999';
    document.body.appendChild(modalRoot);
  }

  // Determine orientation class for responsive styling
  const getOrientationClass = (item: MediaItem) => {
    if (!item.orientation && item.width && item.height) {
      const ratio = item.width / item.height;
      if (ratio > 1.05) return 'landscape';
      if (ratio < 0.95) return 'portrait';
      return 'square';
    }
    return item.orientation || 'landscape';
  };

  const orientation = getOrientationClass(currentPhoto);
  const isLandscape = orientation === 'landscape';
  const imageKey = getImageKey(currentPhoto, currentIndex);
  const isLoaded = loaded[imageKey];

  const lightboxContent = (
    <div className="fixed inset-0 z-[9999] lightbox-preview" data-lightbox="true">
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-black/95"
        aria-label="Lightbox background"
      />
      
      {/* Content container - handles background clicks only */}
      <div 
        className="relative z-10 flex h-full w-full items-center justify-center lightbox-content"
        onClick={(e) => {
          // Only close if clicking directly on this container (the background area)
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Back to Gallery button (when opened from gallery) */}
        {onBackToGallery && source === 'gallery' && (
          <Button
            className={cn(
              "absolute z-50 rounded-full bg-gray-800/70 hover:bg-gray-700",
              isMobile ? "left-2 top-2 h-8 w-8" : "left-4 top-4 h-10 w-10"
            )}
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onBackToGallery();
            }}
          >
            <ChevronLeft className={cn("text-white", isMobile ? "h-5 w-5" : "h-6 w-6")} />
            <span className="sr-only">Back to gallery</span>
          </Button>
        )}

        {/* Close button */}
        <Button 
          className={cn(
            "absolute right-4 z-50 rounded-full bg-gray-800/70 hover:bg-gray-700",
            isMobile ? "right-2 top-2 h-8 w-8" : "right-4 top-4 h-10 w-10"
          )}
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClose();
          }}
        >
          <X className={cn("text-white", isMobile ? "h-5 w-5" : "h-6 w-6")} />
          <span className="sr-only">Close</span>
        </Button>

        {/* 3-dot dropdown menu */}
        <div className={cn(
          "absolute z-50",
          isMobile ? "right-12 top-2" : "right-16 top-4"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "rounded-full bg-gray-800/70 hover:bg-gray-700",
                  isMobile ? "h-8 w-8" : "h-10 w-10"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <MoreVertical className={cn("text-white", isMobile ? "h-4 w-4" : "h-5 w-5")} />
                <span className="sr-only">Photo options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-48 bg-background border border-border shadow-lg z-[10000]"
              onClick={(e) => e.stopPropagation()}
            >
              {isOwner(currentPhoto) ? (
                <>
                  {onEditPhoto && (
                    <DropdownMenuItem 
                      onClick={() => onEditPhoto(currentPhoto)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Media
                    </DropdownMenuItem>
                  )}
                  {onDeletePhoto && (
                    <DropdownMenuItem 
                      onClick={() => onDeletePhoto(currentPhoto)}
                      className="flex items-center gap-2 cursor-pointer text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Media
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                onReport && (
                  <DropdownMenuItem 
                    onClick={() => onReport(currentPhoto)}
                    className="flex items-center gap-2 cursor-pointer text-destructive hover:text-destructive"
                  >
                    <Flag className="h-4 w-4" />
                    Report Media
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Photo counter */}
        {photos.length > 1 && (
          <div className={cn(
            "absolute bg-black/50 px-3 py-1 rounded text-white text-sm z-50",
            isMobile ? "top-2 left-2" : "top-4 left-4"
          )}>
            {currentIndex + 1} / {photos.length}
          </div>
        )}
        
        {/* Main image container */}
        <div className={cn(
          "relative flex h-full w-full items-center justify-center",
          isMobile ? "px-2" : "px-12"
        )}>
          {/* Current media item */}
          <div className="relative flex h-full max-h-[90vh] w-full items-center justify-center">
            {currentPhoto.type === 'video' ? (
              <video
                key={imageKey}
                src={currentPhoto.url}
                poster={currentPhoto.thumbnail_url}
                controls
                preload="metadata"
                autoPlay={false}
                className={cn(
                  "cursor-auto [&::-webkit-media-controls]:cursor-pointer [&::-webkit-media-controls-panel]:cursor-pointer",
                  isMobile && isLandscape 
                    ? "h-auto w-full object-contain" 
                    : "max-h-[90vh] max-w-full object-contain"
                )}
                style={{ cursor: 'auto' }}
                onLoadedData={() => handleImageLoad(currentPhoto, currentIndex)}
                onClick={(e) => e.stopPropagation()}
                onPlay={(e) => e.stopPropagation()}
                onPause={(e) => e.stopPropagation()}
                onVolumeChange={(e) => e.stopPropagation()}
                onTimeUpdate={(e) => e.stopPropagation()}
                onSeeking={(e) => e.stopPropagation()}
                onSeeked={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <img
                  key={imageKey}
                  src={currentPhoto.url}
                  alt={currentPhoto.alt || 'Photo'}
                  className={cn(
                    "transition-opacity duration-300",
                    isLoaded ? "opacity-100" : "opacity-0",
                    isMobile && isLandscape 
                      ? "h-auto w-full object-contain"
                      : "max-h-[90vh] max-w-full object-contain"
                  )}
                  style={isMobile && isLandscape ? { maxHeight: '85vh' } : undefined}
                  onLoad={() => handleImageLoad(currentPhoto, currentIndex)}
                  onClick={(e) => e.stopPropagation()}
                />
                {!isLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-white" />
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Navigation controls - only shown when there are multiple items */}
          {photos.length > 1 && (
            <>
              {/* Previous button */}
              <Button
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 rounded-full bg-gray-800/70 hover:bg-gray-700",
                  isMobile 
                    ? "left-1 h-8 w-8" 
                    : "left-4 h-12 w-12"
                )}
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onPrevious();
                }}
              >
                <ChevronLeft className={cn("text-white", isMobile ? "h-5 w-5" : "h-8 w-8")} />
                <span className="sr-only">Previous image</span>
              </Button>
              
              {/* Next button */}
              <Button
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 rounded-full bg-gray-800/70 hover:bg-gray-700",
                  isMobile 
                    ? "right-1 h-8 w-8" 
                    : "right-4 h-12 w-12"
                )}
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onNext();
                }}
              >
                <ChevronRight className={cn("text-white", isMobile ? "h-5 w-5" : "h-8 w-8")} />
                <span className="sr-only">Next image</span>
              </Button>
            </>
          )}
        </div>

        {/* Photo metadata */}
        <div className={cn(
          "absolute bg-black/70 text-white p-4 rounded-lg max-w-md z-40",
          currentPhoto.type === 'video' 
            ? isMobile ? 'top-16 left-2' : 'top-20 left-4'
            : isMobile ? 'bottom-2 left-2' : 'bottom-4 left-4'
        )}>
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
    </div>
  );

  return createPortal(lightboxContent, modalRoot);
};