import React, { useState, useEffect } from 'react';
import { Camera, Flag, ExternalLink, User, Calendar, RefreshCw, Filter, Trash2, Edit3, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Entity } from '@/services/recommendation/types';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { PhotoReportModal } from '@/components/ui/photo-report-modal';
import { PhotoWithMetadata, fetchGooglePlacesPhotos, fetchEntityReviewMedia } from '@/services/photoService';
import { fetchEntityPhotos, deleteEntityPhoto, type EntityPhoto } from '@/services/entityPhotoService';
import { EntityPhotoUploader } from './EntityPhotoUploader';
import { EntityPhotoEditModal } from './EntityPhotoEditModal';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';


interface PhotosSectionProps {
  entity: Entity;
}

export const PhotosSection: React.FC<PhotosSectionProps> = ({ entity }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [reportModalPhoto, setReportModalPhoto] = useState<PhotoWithMetadata | null>(null);
  const [photos, setPhotos] = useState<PhotoWithMetadata[]>([]);
  const [entityPhotos, setEntityPhotos] = useState<EntityPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  
  // Photo management states
  const [editingPhoto, setEditingPhoto] = useState<EntityPhoto | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<EntityPhoto | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const [googlePhotos, reviewPhotos, userPhotos] = await Promise.all([
        fetchGooglePlacesPhotos(entity),
        fetchEntityReviewMedia(entity.id),
        fetchEntityPhotos(entity.id)
      ]);
      
      const allPhotos = [...googlePhotos, ...reviewPhotos];
      setPhotos(allPhotos);
      setEntityPhotos(userPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityPhotoUploaded = (newPhoto: EntityPhoto) => {
    setEntityPhotos(prev => [newPhoto, ...prev]);
  };

  const handlePhotoUpdated = (updatedPhoto: EntityPhoto) => {
    setEntityPhotos(prev => 
      prev.map(photo => photo.id === updatedPhoto.id ? updatedPhoto : photo)
    );
  };

  const handleDeletePhoto = async () => {
    if (!deletingPhoto) return;
    
    setIsDeletingPhoto(true);
    try {
      const success = await deleteEntityPhoto(deletingPhoto.id);
      
      if (success) {
        setEntityPhotos(prev => prev.filter(photo => photo.id !== deletingPhoto.id));
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

  const isOwner = (photo: PhotoWithMetadata): boolean => {
    return photo.source === 'entity_photo' && 
           user && 
           entityPhotos.some(ep => ep.id === photo.id && ep.user_id === user.id);
  };

  const getAllPhotosWithEntityPhotos = (): PhotoWithMetadata[] => {
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

    return [...convertedEntityPhotos, ...photos];
  };

  const getFilteredPhotos = (): PhotoWithMetadata[] => {
    const allPhotos = getAllPhotosWithEntityPhotos();
    
    switch (activeTab) {
      case 'google':
        return allPhotos.filter(photo => photo.source === 'google_places');
      case 'reviews':
        return allPhotos.filter(photo => photo.source === 'user_review');
      case 'entity':
        return allPhotos.filter(photo => photo.source === 'entity_photo');
      default:
        return allPhotos;
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [entity.id]);

  const handlePhotoClick = (index: number) => {
    setSelectedPhotoIndex(index);
  };

  const handleReportPhoto = (photo: PhotoWithMetadata) => {
    if (!user) {
      // Could show login modal here
      return;
    }
    setReportModalPhoto(photo);
  };

  const closeLightbox = () => {
    setSelectedPhotoIndex(null);
  };

  const closeReportModal = () => {
    setReportModalPhoto(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Camera className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Photos & Videos</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-muted animate-pulse rounded-lg"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const allPhotos = getAllPhotosWithEntityPhotos();
  const filteredPhotos = getFilteredPhotos();

  if (allPhotos.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Photos & Videos</h3>
            </div>
            <EntityPhotoUploader
              entityId={entity.id}
              onPhotoUploaded={handleEntityPhotoUploaded}
            />
          </div>
          <div className="text-center py-12">
            <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="font-medium text-muted-foreground mb-2">No photos available</h4>
            <p className="text-sm text-muted-foreground">
              Be the first to share photos of {entity.name}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Photos & Videos</h3>
              <span className="text-sm text-muted-foreground">({allPhotos.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <EntityPhotoUploader
                entityId={entity.id}
                onPhotoUploaded={handleEntityPhotoUploaded}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={loadPhotos}
                disabled={loading}
                className="h-8"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({allPhotos.length})</TabsTrigger>
              <TabsTrigger value="entity">User Photos ({entityPhotos.length})</TabsTrigger>
              <TabsTrigger value="google">Google Places ({allPhotos.filter(p => p.source === 'google_places').length})</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({allPhotos.filter(p => p.source === 'user_review').length})</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredPhotos.map((photo, index) => (
              <div
                key={`${photo.source}-${photo.id || index}`}
                className="relative group aspect-square overflow-hidden rounded-lg cursor-pointer bg-muted"
                onClick={() => handlePhotoClick(index)}
              >
                <img
                  src={photo.url}
                  alt={photo.alt || entity.name}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.parentElement?.querySelector('.fallback-placeholder');
                    if (!fallback) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'fallback-placeholder w-full h-full bg-muted flex items-center justify-center';
                      placeholder.innerHTML = '<div class="text-muted-foreground">📷</div>';
                      target.parentElement?.appendChild(placeholder);
                    }
                  }}
                />
                
                {/* Photo overlay with metadata */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-1 text-white text-xs">
                      {photo.source === 'google_places' ? (
                        <>
                          <ExternalLink className="w-3 h-3" />
                          <span>Google Places</span>
                          {photo.isPrimary && (
                            <span className="bg-blue-500 text-white px-1 rounded text-xs">Primary</span>
                          )}
                        </>
                      ) : photo.source === 'entity_photo' ? (
                        <>
                          <Camera className="w-3 h-3" />
                          <span>{photo.username || 'User'}</span>
                          {photo.category && (
                            <span className="bg-green-500 text-white px-1 rounded text-xs">{photo.category}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3" />
                          <span>{photo.username || 'User'}</span>
                          {photo.isTimelineUpdate && (
                            <span className="bg-purple-500 text-white px-1 rounded text-xs">Timeline</span>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Action dropdown menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 w-6 p-0 text-white hover:bg-white/20"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        className="w-48 bg-popover border border-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isOwner(photo) ? (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                const entityPhoto = entityPhotos.find(ep => ep.id === photo.id);
                                if (entityPhoto) setEditingPhoto(entityPhoto);
                              }}
                              className="cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit Photo
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                const entityPhoto = entityPhotos.find(ep => ep.id === photo.id);
                                if (entityPhoto) setDeletingPhoto(entityPhoto);
                              }}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Photo
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportPhoto(photo);
                            }}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Flag className="w-4 h-4 mr-2" />
                            Report Photo
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {photo.createdAt && (
                      <div className="flex items-center gap-1 text-white text-xs">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(photo.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </CardContent>
      </Card>

      {/* Lightbox for full-screen viewing */}
      {selectedPhotoIndex !== null && (
        <PhotoLightbox
          photos={filteredPhotos}
          currentIndex={selectedPhotoIndex}
          onClose={closeLightbox}
          onNext={() => setSelectedPhotoIndex((selectedPhotoIndex + 1) % filteredPhotos.length)}
          onPrevious={() => setSelectedPhotoIndex((selectedPhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length)}
          onReport={(photo) => handleReportPhoto(photo as PhotoWithMetadata)}
        />
      )}

      {/* Report modal */}
      {reportModalPhoto && (
        <PhotoReportModal
          photo={reportModalPhoto}
          entityId={entity.id}
          onClose={closeReportModal}
          onReported={() => {
            closeReportModal();
            // Optional: Show success toast
          }}
        />
      )}

      {/* Edit photo modal */}
      {editingPhoto && (
        <EntityPhotoEditModal
          photo={editingPhoto}
          isOpen={!!editingPhoto}
          onClose={() => setEditingPhoto(null)}
          onPhotoUpdated={handlePhotoUpdated}
        />
      )}

      {/* Delete confirmation dialog */}
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