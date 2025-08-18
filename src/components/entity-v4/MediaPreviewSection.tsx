import React, { useState, useEffect } from 'react';
import { Camera, ChevronRight, Play, Plus, MoreVertical, Edit3, Trash2, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { PhotoGalleryModal } from '@/components/ui/photo-gallery-modal';
import { PhotoReportModal } from '@/components/ui/photo-report-modal';
import { PhotoWithMetadata, fetchGooglePlacesPhotos, fetchEntityReviewMedia, PhotoQuality } from '@/services/photoService';
import { fetchEntityPhotos, deleteEntityPhoto, type EntityPhoto } from '@/services/entityPhotoService';
import { uploadEntityMediaBatch } from '@/services/entityMediaService';
import { SimpleMediaUploadModal } from './SimpleMediaUploadModal';
import { EntityPhotoEditModal } from './EntityPhotoEditModal';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
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
  const [entityPhotos, setEntityPhotos] = useState<EntityPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryScrollPosition, setGalleryScrollPosition] = useState(0);
  const [lightboxSource, setLightboxSource] = useState<'direct' | 'gallery'>('direct');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Photo management states
  const [reportModalPhoto, setReportModalPhoto] = useState<PhotoWithMetadata | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<EntityPhoto | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<EntityPhoto | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      // Request high quality for main image, medium for grid images  
      const qualityPreference: PhotoQuality[] = ['high', 'medium', 'medium', 'medium', 'medium'];
      
      const [googlePhotos, reviewPhotos, userPhotos] = await Promise.all([
        fetchGooglePlacesPhotos(entity, qualityPreference),
        fetchEntityReviewMedia(entity.id),
        fetchEntityPhotos(entity.id)
      ]);
      
      // Store entity photos separately for ownership detection
      setEntityPhotos(userPhotos);
      
      // Convert entity photos to PhotoWithMetadata format
      const convertedEntityPhotos: PhotoWithMetadata[] = userPhotos.map((photo, index) => ({
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

  // Photo management handlers
  const isOwner = (photo: PhotoWithMetadata): boolean => {
    return photo.source === 'entity_photo' && 
           user && 
           entityPhotos.some(ep => ep.id === photo.id && ep.user_id === user.id);
  };

  const handleReportPhoto = (photo: PhotoWithMetadata) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to report photos.",
        variant: "destructive",
      });
      return;
    }
    setReportModalPhoto(photo);
  };

  const handlePhotoUpdated = (updatedPhoto: EntityPhoto) => {
    setEntityPhotos(prev => 
      prev.map(photo => photo.id === updatedPhoto.id ? updatedPhoto : photo)
    );
    // Also update the photos array
    setPhotos(prev => prev.map(photo => {
      if (photo.source === 'entity_photo' && photo.id === updatedPhoto.id) {
        return {
          ...photo,
          caption: updatedPhoto.caption,
          alt: updatedPhoto.alt_text || updatedPhoto.caption,
          category: updatedPhoto.category
        };
      }
      return photo;
    }));
  };

  const handleDeletePhoto = async () => {
    if (!deletingPhoto) return;
    
    setIsDeletingPhoto(true);
    try {
      const success = await deleteEntityPhoto(deletingPhoto.id);
      
      if (success) {
        setEntityPhotos(prev => prev.filter(photo => photo.id !== deletingPhoto.id));
        setPhotos(prev => prev.filter(photo => photo.id !== deletingPhoto.id));
        setDeletingPhoto(null);
        
        toast({
          title: "Photo deleted",
          description: "Your photo has been deleted successfully.",
        });
      } else {
        throw new Error('Failed to delete photo');
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: "Error",
        description: "Failed to delete photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const closeReportModal = () => {
    setReportModalPhoto(null);
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
              
              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex justify-between p-3 pointer-events-none">
                <div></div>
                {/* 3-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20 pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {isOwner(mainPhoto) ? (
                      <>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            const entityPhoto = entityPhotos.find(ep => ep.id === mainPhoto.id);
                            if (entityPhoto) setEditingPhoto(entityPhoto);
                          }}
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit Media
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            const entityPhoto = entityPhotos.find(ep => ep.id === mainPhoto.id);
                            if (entityPhoto) setDeletingPhoto(entityPhoto);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Media
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReportPhoto(mainPhoto);
                        }}
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Report Media
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
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
                  
                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex justify-between p-2">
                    <div></div>
                    {/* 3-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-white hover:bg-white/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {isOwner(photo) ? (
                          <>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                const entityPhoto = entityPhotos.find(ep => ep.id === photo.id);
                                if (entityPhoto) setEditingPhoto(entityPhoto);
                              }}
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit Media
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                const entityPhoto = entityPhotos.find(ep => ep.id === photo.id);
                                if (entityPhoto) setDeletingPhoto(entityPhoto);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Media
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportPhoto(photo);
                            }}
                          >
                            <Flag className="w-4 h-4 mr-2" />
                            Report Media
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
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
        entityPhotos={entityPhotos}
        onEdit={setEditingPhoto}
        onDelete={setDeletingPhoto}
        onReport={handleReportPhoto}
        isOwner={isOwner}
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
          onReport={handleReportPhoto}
          onBackToGallery={lightboxSource === 'gallery' ? backToGallery : undefined}
          source={lightboxSource}
          entityPhotos={entityPhotos}
          onEdit={setEditingPhoto}
          onDelete={setDeletingPhoto}
          isOwner={isOwner}
        />
      )}

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

      {/* Photo Report Modal */}
      {reportModalPhoto && (
        <PhotoReportModal
          photo={reportModalPhoto}
          entityId={entity.id}
          onClose={closeReportModal}
          onReported={() => {
            closeReportModal();
            toast({
              title: "Photo reported",
              description: "Thank you for helping keep our community safe.",
            });
          }}
        />
      )}

      {/* Entity Photo Edit Modal */}
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
        onConfirm={handleDeletePhoto}
        title="Delete Photo"
        description="Are you sure you want to delete this photo? This action cannot be undone."
        isLoading={isDeletingPhoto}
      />
    </>
  );
};