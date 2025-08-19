import React, { useState, useEffect } from 'react';
import { Camera, ChevronRight, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { PhotoGalleryModal } from '@/components/ui/photo-gallery-modal';
import { PhotoReportModal } from '@/components/ui/photo-report-modal';
import { EntityPhotoEditModal } from './EntityPhotoEditModal';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { PhotoWithMetadata, fetchGooglePlacesPhotos, fetchEntityReviewMedia, PhotoQuality } from '@/services/photoService';
import { fetchEntityPhotos, deleteEntityPhoto } from '@/services/entityPhotoService';
import { uploadEntityMediaBatch } from '@/services/entityMediaService';
import { SimpleMediaUploadModal } from './SimpleMediaUploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Entity } from '@/services/recommendation/types';

interface MediaPreviewSectionProps {
  entity: Entity;
  onViewAllClick?: () => void;
}

export const MediaPreviewSection: React.FC<MediaPreviewSectionProps> = ({ 
  entity, 
  onViewAllClick 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<PhotoWithMetadata[]>([]);
  const [entityPhotos, setEntityPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);
  const [lightboxSource, setLightboxSource] = useState<'direct' | 'gallery'>('direct');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Modal states
  const [reportModalPhoto, setReportModalPhoto] = useState<PhotoWithMetadata | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<any | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<any | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      // Request high quality for main image, medium for grid images  
      const qualityPreference: PhotoQuality[] = ['high', 'medium', 'medium', 'medium', 'medium'];
      
      const [googlePhotos, reviewPhotos, fetchedEntityPhotos] = await Promise.all([
        fetchGooglePlacesPhotos(entity, qualityPreference),
        fetchEntityReviewMedia(entity.id),
        fetchEntityPhotos(entity.id)
      ]);
      
      // Store entity photos for ownership checking
      setEntityPhotos(fetchedEntityPhotos);
      
      // Convert entity photos to PhotoWithMetadata format
      const convertedEntityPhotos: PhotoWithMetadata[] = fetchedEntityPhotos.map((photo, index) => ({
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
    setLightboxSource('direct');
  };

  const handleGalleryPhotoClick = (index: number) => {
    setSelectedPhotoIndex(index);
    setLightboxSource('gallery');
  };

  const closeLightbox = () => {
    setSelectedPhotoIndex(null);
  };

  const openGallery = () => {
    setIsGalleryOpen(true);
  };

  const closeGallery = () => {
    setIsGalleryOpen(false);
    setGalleryScrollPosition(0);
  };

  const backToGallery = () => {
    setSelectedPhotoIndex(null);
    setIsGalleryOpen(true);
  };

  const handleViewAllClick = () => {
    if (onViewAllClick) {
      onViewAllClick();
    } else {
      openGallery();
    }
  };

  // Modal handlers
  const handleReportPhoto = (photo: PhotoWithMetadata) => {
    setReportModalPhoto(photo);
  };

  const handleEditPhoto = (photo: any) => {
    setEditingPhoto(photo);
  };

  const handleDeletePhoto = (photo: any) => {
    setDeletingPhoto(photo);
  };

  const handlePhotoUpdated = (updatedPhoto: any) => {
    setEditingPhoto(null);
    loadPhotos(); // Refresh photos after edit
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPhoto || !user) return;

    setIsDeletingPhoto(true);
    try {
      await deleteEntityPhoto(deletingPhoto.id);
      
      toast({
        title: "Photo deleted",
        description: "The photo has been successfully deleted.",
      });
      
      setDeletingPhoto(null);
      loadPhotos(); // Refresh photos after delete
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: "Delete failed",
        description: "Failed to delete photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingPhoto(false);
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
                size="sm"
                variant="default"
                onClick={() => setShowUploadModal(true)}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Media
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
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
              
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
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                  
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
                  onClick={openGallery}
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

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        photos={photos}
        isOpen={isGalleryOpen}
        onClose={closeGallery}
        onPhotoClick={handleGalleryPhotoClick}
        initialScrollPosition={galleryScrollPosition}
        onScrollPositionChange={setGalleryScrollPosition}
      />

      {/* Photo Lightbox */}
      {selectedPhotoIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={selectedPhotoIndex}
          onClose={lightboxSource === 'gallery' ? backToGallery : closeLightbox}
          onPrevious={() => setSelectedPhotoIndex(prev => 
            prev !== null ? (prev > 0 ? prev - 1 : photos.length - 1) : null
          )}
          onNext={() => setSelectedPhotoIndex(prev => 
            prev !== null ? (prev < photos.length - 1 ? prev + 1 : 0) : null
          )}
          onBackToGallery={lightboxSource === 'gallery' ? backToGallery : undefined}
          source={lightboxSource}
          entityPhotos={entityPhotos}
          entity={entity}
          user={user}
          onEdit={handleEditPhoto}
          onDelete={handleDeletePhoto}
          onReportComplete={handleReportPhoto}
        />
      )}

      {/* Report Modal */}
      {reportModalPhoto && (
        <PhotoReportModal
          photo={reportModalPhoto}
          entityId={entity.id}
          onClose={() => setReportModalPhoto(null)}
          onReported={() => {
            setReportModalPhoto(null);
            toast({
              title: "Report submitted",
              description: "Thank you for reporting this content.",
            });
          }}
        />
      )}

      {/* Edit Modal */}
      {editingPhoto && (
        <EntityPhotoEditModal
          photo={editingPhoto}
          isOpen={!!editingPhoto}
          onClose={() => setEditingPhoto(null)}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={!!deletingPhoto}
        onClose={() => setDeletingPhoto(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Photo"
        description="Are you sure you want to delete this photo? This action cannot be undone."
        isLoading={isDeletingPhoto}
      />

      {/* Upload Modal */}
      <SimpleMediaUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSave={async (mediaItems) => {
          if (!user) {
            toast({
              title: "Authentication required",
              description: "Please sign in to upload media.",
              variant: "destructive",
            });
            return;
          }

          try {
            await uploadEntityMediaBatch(mediaItems, entity.id, user.id);
            
            toast({
              title: "Media uploaded successfully",
              description: `${mediaItems.length} item(s) have been added.`,
            });
            
            // Refresh photos to include the new ones
            loadPhotos();
          } catch (error) {
            console.error('Error uploading media:', error);
            toast({
              title: "Upload failed",
              description: "Failed to upload media. Please try again.",
              variant: "destructive",
            });
          }
        }}
      />
    </>
  );
};