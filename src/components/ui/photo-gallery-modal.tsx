import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Filter, SortAsc, SortDesc, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { PHOTO_CATEGORIES, EntityPhoto } from '@/services/entityPhotoService';

interface PhotoGalleryModalProps {
  photos: (MediaItem & { source?: string; username?: string; createdAt?: string })[];
  isOpen: boolean;
  onClose: () => void;
  onPhotoClick: (index: number) => void;
  initialScrollPosition?: number;
  onScrollPositionChange?: (position: number) => void;
  galleryPhotoIndex?: number | null;
  onResetGalleryScroll?: () => void;
  entityPhotos?: EntityPhoto[];
  onEdit?: (photo: EntityPhoto) => void;
  onDelete?: (photo: EntityPhoto) => void;
  onReport?: (photo: MediaItem & { source?: string; username?: string; createdAt?: string }) => void;
  isOwner?: (photo: MediaItem & { source?: string; username?: string; createdAt?: string }) => boolean;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  photos,
  isOpen,
  onClose,
  onPhotoClick,
  initialScrollPosition = 0,
  onScrollPositionChange,
  galleryPhotoIndex,
  onResetGalleryScroll,
  entityPhotos = [],
  onEdit,
  onDelete,
  onReport,
  isOwner
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'google_places' | 'reviews' | 'user'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
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

  // Filter and sort photos (enhanced with category filtering)
  const filteredAndSortedPhotos = React.useMemo(() => {
    let filtered = photos;

    // Filter by tab/source
    if (activeTab !== 'all') {
      filtered = photos.filter(photo => {
        switch (activeTab) {
          case 'google_places':
            return photo.source === 'google_places';
          case 'reviews':
            return photo.source === 'user_review';
          case 'user':
            return photo.source === 'entity_photo';
          default:
            return true;
        }
      });
    }

    // Filter by category (only for entity photos)
    if (categoryFilter && activeTab === 'user') {
      filtered = filtered.filter(photo => 
        photo.source === 'entity_photo' && (photo as any).category === categoryFilter
      );
    }

    // Sort photos
    return filtered.sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      
      if (sortBy === 'newest') {
        return bDate - aDate;
      } else {
        return aDate - bDate;
      }
    });
  }, [photos, activeTab, sortBy, categoryFilter]);

  // Get category counts (using correct source values and adding category counts)
  const categoryCounts = React.useMemo(() => {
    const entityPhotos = photos.filter(p => p.source === 'entity_photo');
    const categoryBreakdown: Record<string, number> = {};
    
    entityPhotos.forEach(photo => {
      const category = (photo as any).category || 'general';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });

    return {
      all: photos.length,
      google_places: photos.filter(p => p.source === 'google_places').length,
      reviews: photos.filter(p => p.source === 'user_review').length,
      user: entityPhotos.length,
      categories: categoryBreakdown
    };
  }, [photos]);

  const clearFilters = () => {
    setCategoryFilter(null);
    setSortBy('newest');
  };

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
    <div className="fixed inset-0 z-[9998] photo-gallery-modal flex items-center justify-center p-4" data-gallery="true">
      {/* Background overlay with blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Content container - floating design */}
      <div className="relative z-10 flex h-full w-full max-w-6xl max-h-[90vh] flex-col bg-background rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-background p-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-foreground">
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
                    activeTab === key ? "" : "text-muted-foreground hover:bg-muted/80"
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
            {/* Category Filter (only for entity photos) */}
            {activeTab === 'user' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[120px]">
                    <Filter className="w-4 h-4 mr-2" />
                    {categoryFilter ? PHOTO_CATEGORIES.find(c => c.value === categoryFilter)?.label || categoryFilter : 'All Categories'}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.preventDefault();
                      setCategoryFilter(null);
                    }}
                  >
                    All Categories ({categoryCounts.user})
                  </DropdownMenuItem>
                  {PHOTO_CATEGORIES.map((category) => {
                    const count = categoryCounts.categories[category.value] || 0;
                    return (
                      <DropdownMenuItem 
                        key={category.value} 
                        onClick={(e) => {
                          e.preventDefault();
                          setCategoryFilter(category.value);
                        }}
                        disabled={count === 0}
                      >
                        {category.label} ({count})
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[140px]">
                  {sortBy === 'newest' && <><SortDesc className="w-4 h-4 mr-2" />Newest First</>}
                  {sortBy === 'oldest' && <><SortAsc className="w-4 h-4 mr-2" />Oldest First</>}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    setSortBy('newest');
                  }}
                >
                  <SortDesc className="w-4 h-4 mr-2" />
                  Newest First
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    setSortBy('oldest');
                  }}
                >
                  <SortAsc className="w-4 h-4 mr-2" />
                  Oldest First
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-muted/80"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
              <span className="sr-only">Close gallery</span>
            </Button>
          </div>
        </div>

        {/* Mobile filters */}
        <div className="md:hidden border-b border-border bg-background p-4">
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
                  "whitespace-nowrap",
                  activeTab === key ? "" : "text-muted-foreground hover:bg-muted/80"
                )}
                onClick={() => setActiveTab(key as any)}
                disabled={count === 0}
              >
                {label} ({count})
              </Button>
            ))}
          </div>
        </div>

        {/* Active Filter Badges */}
        {(categoryFilter || sortBy !== 'newest') && (
          <div className="border-b border-border bg-background p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {categoryFilter && (
                <Badge variant="secondary" className="text-xs">
                  {PHOTO_CATEGORIES.find(c => c.value === categoryFilter)?.label || categoryFilter}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setCategoryFilter(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )}
              {(categoryFilter || sortBy !== 'newest') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground h-6"
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Photo grid */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4"
        >
          {filteredAndSortedPhotos.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground">No photos found in this category</p>
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
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted"
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
                     photo.source === 'user_review' ? 'R' : 'U'}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PhotoLightbox Integration */}
        {galleryPhotoIndex !== null && (
          <PhotoLightbox
            photos={filteredAndSortedPhotos}
            currentIndex={galleryPhotoIndex}
            onClose={onClose}
            onNext={() => {
              const nextIndex = (galleryPhotoIndex + 1) % filteredAndSortedPhotos.length;
              const originalIndex = photos.findIndex(p => p.url === filteredAndSortedPhotos[nextIndex]?.url);
              if (originalIndex !== -1) {
                onPhotoClick(originalIndex);
              }
            }}
            onPrevious={() => {
              const prevIndex = (galleryPhotoIndex - 1 + filteredAndSortedPhotos.length) % filteredAndSortedPhotos.length;
              const originalIndex = photos.findIndex(p => p.url === filteredAndSortedPhotos[prevIndex]?.url);
              if (originalIndex !== -1) {
                onPhotoClick(originalIndex);
              }
            }}
            onBackToGallery={() => {
              if (onPhotoClick) onPhotoClick(-1);
            }}
            source="gallery"
            entityPhotos={entityPhotos}
            onEdit={onEdit}
            onDelete={onDelete}
            onReport={onReport}
            isOwner={isOwner}
          />
        )}
      </div>
    </div>
  );

  return createPortal(galleryContent, modalRoot);
};