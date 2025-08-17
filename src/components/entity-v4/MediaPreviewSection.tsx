import React, { useState, useEffect } from 'react';
import { Camera, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { PhotoWithMetadata, fetchGooglePlacesPhotos, fetchEntityReviewMedia } from '@/services/photoService';
import { fetchEntityPhotos } from '@/services/entityPhotoService';
import { Entity } from '@/services/recommendation/types';

interface MediaPreviewSectionProps {
  entity: Entity;
  onViewAllClick?: () => void;
}

export const MediaPreviewSection: React.FC<MediaPreviewSectionProps> = ({ 
  entity, 
  onViewAllClick 
}) => {
  const [photos, setPhotos] = useState<PhotoWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const [googlePhotos, reviewPhotos, entityPhotos] = await Promise.all([
        fetchGooglePlacesPhotos(entity),
        fetchEntityReviewMedia(entity.id),
        fetchEntityPhotos(entity.id)
      ]);
      
      // Convert entity photos to PhotoWithMetadata format
      const convertedEntityPhotos: PhotoWithMetadata[] = entityPhotos.map((photo, index) => ({
        id: photo.id,
        url: photo.url,
        type: 'image' as const,
        order: index,
        source: 'entity_photo' as const,
        alt: photo.alt_text || photo.caption,
        width: photo.width,
        height: photo.height,
        caption: photo.caption,
        username: photo.username,
        createdAt: photo.created_at,
        category: photo.category
      }));
      
      const allPhotos = [...convertedEntityPhotos, ...googlePhotos, ...reviewPhotos];
      setPhotos(allPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [entity.id]);

  const handlePhotoClick = (index: number) => {
    setSelectedPhotoIndex(index);
  };

  const closeLightbox = () => {
    setSelectedPhotoIndex(null);
  };

  const handleViewAllClick = () => {
    if (onViewAllClick) {
      onViewAllClick();
    } else {
      // Default behavior: scroll to tabs section
      const tabsSection = document.querySelector('[data-tabs="photos"]');
      if (tabsSection) {
        tabsSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Show loading skeleton
  if (loading) {
    return (
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-2 h-auto">
            {/* Main Image Skeleton */}
            <div className="bg-muted animate-pulse rounded-lg aspect-[4/3]" />
            
            {/* Side Images Skeleton - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="bg-muted animate-pulse rounded-lg aspect-[4/3]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if no photos
  if (photos.length === 0) {
    return null;
  }

  // Show up to 5 photos in preview (1 main + 4 side)
  const previewPhotos = photos.slice(0, 5);
  const mainPhoto = previewPhotos[0];
  const sidePhotos = previewPhotos.slice(1);
  const hasMorePhotos = photos.length > 5;

  return (
    <>
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Photos & Videos</h3>
              <span className="text-sm text-muted-foreground">({photos.length})</span>
            </div>
            {photos.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleViewAllClick}
                className="gap-2"
              >
                View All Photos
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Airbnb-style layout */}
          <div className="grid grid-cols-2 gap-2 h-auto">
            {/* Main Image - Left Half */}
            <div className="relative group cursor-pointer overflow-hidden rounded-lg aspect-[4/3]">
              <img
                src={mainPhoto.url}
                alt={mainPhoto.alt || entity.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onClick={() => handlePhotoClick(0)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              
              {/* Photo metadata overlay */}
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                <span className="text-sm font-medium flex items-center gap-1">
                  {mainPhoto.type === 'video' ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {mainPhoto.source === 'google_places' && 'Google Places'}
                  {mainPhoto.source === 'user_review' && 'Review Photo'}
                  {mainPhoto.source === 'entity_photo' && (mainPhoto.category || 'User Photo')}
                </span>
              </div>
            </div>

            {/* Right Side - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
              {sidePhotos.slice(0, 3).map((photo, index) => (
                <div 
                  key={index} 
                  className="relative group cursor-pointer overflow-hidden rounded-lg aspect-[4/3]"
                  onClick={() => handlePhotoClick(index + 1)}
                >
                  <img
                    src={photo.url}
                    alt={photo.alt || entity.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  
                  {/* Photo source indicator */}
                  <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                    {photo.source === 'google_places' && 'Google'}
                    {photo.source === 'user_review' && 'Review'}
                    {photo.source === 'entity_photo' && (photo.category || 'User')}
                  </div>
                  
                  {photo.type === 'video' && (
                    <div className="absolute top-2 right-2">
                      <Play className="w-4 h-4 text-white bg-black/50 rounded-full p-1" />
                    </div>
                  )}
                </div>
              ))}
              
              {/* Last image with "Show all photos" overlay if more photos exist */}
              {sidePhotos.length >= 3 && (
                <div 
                  className="relative group cursor-pointer overflow-hidden rounded-lg aspect-[4/3]"
                  onClick={handleViewAllClick}
                >
                  {sidePhotos[3] && (
                    <img
                      src={sidePhotos[3].url}
                      alt={sidePhotos[3].alt || entity.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {hasMorePhotos && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                      <div className="text-center">
                        <span className="text-lg font-semibold">+{photos.length - 4}</span>
                        <p className="text-sm">Show all photos</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Fill empty slots with placeholders if needed */}
              {Array.from({ length: Math.max(0, 4 - sidePhotos.length) }).map((_, index) => (
                <div 
                  key={`placeholder-${index}`} 
                  className="aspect-[4/3] border-2 border-dashed border-muted rounded-lg flex items-center justify-center opacity-50"
                >
                  <Camera className="w-6 h-6 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {selectedPhotoIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={selectedPhotoIndex}
          onClose={closeLightbox}
          onPrevious={() => setSelectedPhotoIndex(prev => 
            prev !== null ? (prev > 0 ? prev - 1 : photos.length - 1) : null
          )}
          onNext={() => setSelectedPhotoIndex(prev => 
            prev !== null ? (prev < photos.length - 1 ? prev + 1 : 0) : null
          )}
          onReport={(photo) => {
            console.log('Report photo:', photo);
            // Could implement photo reporting here
          }}
        />
      )}
    </>
  );
};