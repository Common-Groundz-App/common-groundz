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
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-96">
            {/* Main Image Skeleton */}
            <div className="lg:col-span-3 bg-muted animate-pulse rounded-lg" />
            
            {/* Side Images Skeleton */}
            <div className="space-y-4">
              {[1, 2].map((index) => (
                <div key={index} className="bg-muted animate-pulse rounded-lg h-44" />
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

  // Show up to 3 photos in preview (1 main + 2 side)
  const previewPhotos = photos.slice(0, 3);
  const mainPhoto = previewPhotos[0];
  const sidePhotos = previewPhotos.slice(1);
  const hasMorePhotos = photos.length > 3;

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

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-96">
            {/* Main Image */}
            <div className="lg:col-span-3 relative group cursor-pointer overflow-hidden rounded-lg">
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

              {/* More photos indicator */}
              {hasMorePhotos && (
                <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                  +{photos.length - 1} more
                </div>
              )}
            </div>

            {/* Side Images */}
            <div className="space-y-4">
              {sidePhotos.map((photo, index) => (
                <div 
                  key={index} 
                  className="relative group cursor-pointer overflow-hidden rounded-lg h-44"
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
              
              {/* Placeholder for consistent layout */}
              {sidePhotos.length === 1 && (
                <div className="h-44 border-2 border-dashed border-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">More photos in gallery</p>
                  </div>
                </div>
              )}
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