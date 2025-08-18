import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Filter, SortAsc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface PhotoGalleryModalProps {
  photos: (MediaItem & { source?: string; username?: string; createdAt?: string })[];
  isOpen: boolean;
  onClose: () => void;
  onPhotoClick: (index: number) => void;
  initialScrollPosition?: number;
  onScrollPositionChange?: (position: number) => void;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  photos,
  isOpen,
  onClose,
  onPhotoClick,
  initialScrollPosition = 0,
  onScrollPositionChange
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'google_places' | 'reviews' | 'user'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Restore scroll position when modal opens
  useEffect(() => {
    if (isOpen && scrollContainerRef.current && initialScrollPosition > 0) {
      scrollContainerRef.current.scrollTop = initialScrollPosition;
    }
  }, [isOpen, initialScrollPosition]);

  // Track scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onScrollPositionChange) return;

    const handleScroll = () => {
      onScrollPositionChange(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onScrollPositionChange]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter and sort photos
  const filteredAndSortedPhotos = React.useMemo(() => {
    let filtered = photos;

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = photos.filter(photo => {
        switch (activeTab) {
          case 'google_places':
            return photo.source === 'google_places';
          case 'reviews':
            return photo.source === 'review';
          case 'user':
            return photo.source === 'user' || photo.source === 'entity';
          default:
            return true;
        }
      });
    }

    // Sort photos
    return filtered.sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      
      if (sortBy === 'recent') {
        return bDate - aDate;
      } else {
        return aDate - bDate;
      }
    });
  }, [photos, activeTab, sortBy]);

  // Get category counts
  const categoryCounts = React.useMemo(() => {
    return {
      all: photos.length,
      google_places: photos.filter(p => p.source === 'google_places').length,
      reviews: photos.filter(p => p.source === 'review').length,
      user: photos.filter(p => p.source === 'user' || p.source === 'entity').length
    };
  }, [photos]);

  if (!isOpen) return null;

  // Ensure modal root exists
  let modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    modalRoot.style.position = 'relative';
    modalRoot.style.zIndex = '9999';
    document.body.appendChild(modalRoot);
  }

  const handlePhotoClick = (photo: MediaItem & { source?: string; username?: string; createdAt?: string }) => {
    // Find the index in the original photos array
    const originalIndex = photos.findIndex(p => p.url === photo.url);
    if (originalIndex !== -1) {
      onPhotoClick(originalIndex);
    }
  };

  const galleryContent = (
    <div className="fixed inset-0 z-[9998] photo-gallery-modal" data-gallery="true">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/95" />
      
      {/* Content container */}
      <div className="relative z-10 flex h-full w-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/50 p-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-white">
              All Photos ({photos.length})
            </h2>
            
            {/* Category filters */}
            <div className="hidden md:flex space-x-2">
              {[
                { key: 'all', label: 'All', count: categoryCounts.all },
                { key: 'google_places', label: 'Google Places', count: categoryCounts.google_places },
                { key: 'reviews', label: 'Reviews', count: categoryCounts.reviews },
                { key: 'user', label: 'User Photos', count: categoryCounts.user }
              ].map(({ key, label, count }) => (
                <Button
                  key={key}
                  variant={activeTab === key ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "text-white",
                    activeTab === key ? "bg-primary" : "hover:bg-white/10"
                  )}
                  onClick={() => setActiveTab(key as any)}
                  disabled={count === 0}
                >
                  {label} ({count})
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Sort button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => setSortBy(sortBy === 'recent' ? 'oldest' : 'recent')}
            >
              <SortAsc className="h-4 w-4 mr-2" />
              {sortBy === 'recent' ? 'Newest First' : 'Oldest First'}
            </Button>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
              <span className="sr-only">Close gallery</span>
            </Button>
          </div>
        </div>

        {/* Mobile filters */}
        <div className="md:hidden border-b border-white/10 bg-black/50 p-4">
          <div className="flex space-x-2 overflow-x-auto">
            {[
              { key: 'all', label: 'All', count: categoryCounts.all },
              { key: 'google_places', label: 'Places', count: categoryCounts.google_places },
              { key: 'reviews', label: 'Reviews', count: categoryCounts.reviews },
              { key: 'user', label: 'User', count: categoryCounts.user }
            ].map(({ key, label, count }) => (
              <Button
                key={key}
                variant={activeTab === key ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "text-white whitespace-nowrap",
                  activeTab === key ? "bg-primary" : "hover:bg-white/10"
                )}
                onClick={() => setActiveTab(key as any)}
                disabled={count === 0}
              >
                {label} ({count})
              </Button>
            ))}
          </div>
        </div>

        {/* Photo grid */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4"
        >
          {filteredAndSortedPhotos.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-white/60">No photos found in this category</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-2",
              isMobile 
                ? "grid-cols-2" 
                : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
            )}>
              {filteredAndSortedPhotos.map((photo, index) => (
                <div
                  key={`${photo.url}-${index}`}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-800"
                  onClick={() => handlePhotoClick(photo)}
                >
                  <img
                    src={photo.thumbnail_url || photo.url}
                    alt={photo.alt || 'Photo'}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Video indicator */}
                  {photo.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="rounded-full bg-white/20 p-2">
                        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Source indicator */}
                  <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-xs text-white">
                    {photo.source === 'google_places' ? 'GP' : 
                     photo.source === 'review' ? 'R' : 'U'}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(galleryContent, modalRoot);
};