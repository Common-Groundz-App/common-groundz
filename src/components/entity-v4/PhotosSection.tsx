import React, { useState, useEffect, useMemo } from 'react';
import { FileImage, Flag, ExternalLink, User, Calendar, RefreshCw, Filter, Trash2, Edit3, MoreVertical, SortAsc, SortDesc, ChevronDown, X, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Entity } from '@/services/recommendation/types';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { PhotoReportModal } from '@/components/ui/photo-report-modal';
import { PhotoWithMetadata, fetchGooglePlacesPhotos, fetchEntityReviewMedia } from '@/services/photoService';
import { fetchEntityPhotos, deleteEntityPhoto, type EntityPhoto, PHOTO_CATEGORIES } from '@/services/entityPhotoService';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaItem } from '@/types/media';
import { uploadEntityMedia, convertEntityPhotoToMediaItem } from '@/services/entityMediaService';
import { EntityPhotoEditModal } from './EntityPhotoEditModal';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';


type SortOption = 'newest' | 'oldest';

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
  const [showEntityUpload, setShowEntityUpload] = useState(false);
  
  // Photo management states
  const [editingPhoto, setEditingPhoto] = useState<EntityPhoto | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<EntityPhoto | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  // Phase 2 features - Enhanced Photo Organization
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [photosToShow, setPhotosToShow] = useState(12);
  const PHOTOS_PER_LOAD = 12;

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

  // Handle entity media upload from MediaUploader
  const handleEntityMediaUploaded = async (mediaItem: MediaItem) => {
    if (!entity?.id || !user?.id) return;
    
    try {
      const result = await uploadEntityMedia(
        mediaItem,
        entity.id,
        user.id,
        'general' // Default category, can be made configurable later
      );
      
      if (result.success && result.photo) {
        setEntityPhotos(prev => [result.photo!, ...prev]);
        
        toast({
          title: "Media uploaded",
          description: "Your photo or video has been added successfully"
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Media upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
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

  // Enhanced filtering and sorting logic for Phase 2
  const getFilteredAndSortedPhotos = useMemo((): PhotoWithMetadata[] => {
    const allPhotos = getAllPhotosWithEntityPhotos();
    
    // First filter by tab
    let filteredPhotos = allPhotos;
    switch (activeTab) {
      case 'google':
        filteredPhotos = allPhotos.filter(photo => photo.source === 'google_places');
        break;
      case 'reviews':
        filteredPhotos = allPhotos.filter(photo => photo.source === 'user_review');
        break;
      case 'entity':
        filteredPhotos = allPhotos.filter(photo => photo.source === 'entity_photo');
        break;
      default:
        filteredPhotos = allPhotos;
    }

    // Then filter by category (only for entity photos)
    if (categoryFilter && activeTab === 'entity') {
      filteredPhotos = filteredPhotos.filter(photo => 
        photo.source === 'entity_photo' && photo.category === categoryFilter
      );
    }

    // Sort photos
    const sortedPhotos = [...filteredPhotos].sort((a, b) => {
      const aDate = new Date(a.createdAt || a.order || 0);
      const bDate = new Date(b.createdAt || b.order || 0);
      
      switch (sortBy) {
        case 'oldest':
          return aDate.getTime() - bDate.getTime();
        case 'newest':
        default:
          return bDate.getTime() - aDate.getTime();
      }
    });

    return sortedPhotos;
  }, [photos, entityPhotos, activeTab, categoryFilter, sortBy]);

  // Get category counts for entity photos
  const getCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entityPhotos.forEach(photo => {
      const category = photo.category || 'general';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [entityPhotos]);

  // Legacy method for backward compatibility
  const getFilteredPhotos = (): PhotoWithMetadata[] => {
    return getFilteredAndSortedPhotos.slice(0, photosToShow);
  };

  const hasMorePhotos = getFilteredAndSortedPhotos.length > photosToShow;

  const loadMorePhotos = () => {
    setPhotosToShow(prev => prev + PHOTOS_PER_LOAD);
  };

  const resetPagination = () => {
    setPhotosToShow(PHOTOS_PER_LOAD);
  };

  const clearFilters = () => {
    setCategoryFilter(null);
    setSortBy('newest');
    resetPagination();
  };

  useEffect(() => {
    loadPhotos();
  }, [entity.id]);

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [activeTab, categoryFilter, sortBy]);

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
            <FileImage className="w-5 h-5" />
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
              <FileImage className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Photos & Videos</h3>
            </div>
          </div>
          <div className="text-center py-12">
            <FileImage className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="font-medium text-muted-foreground mb-2">No media available</h4>
            <p className="text-sm text-muted-foreground mb-6">
              Be the first to share photos and videos of {entity.name}
            </p>
            {user && (
              <div className="max-w-md mx-auto">
                <MediaUploader
                  sessionId={`entity-${entity.id}-${Date.now()}`}
                  onMediaUploaded={handleEntityMediaUploaded}
                  initialMedia={[]}
                  className="w-full"
                  customButton={
                    <Button className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      Add Media
                    </Button>
                  }
                  maxMediaCount={10}
                />
              </div>
            )}
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
              <FileImage className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Photos & Videos</h3>
              <span className="text-sm text-muted-foreground">({allPhotos.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Add Media Button */}
              {user && (
                <Button
                  onClick={() => setShowEntityUpload(true)}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Add Media
                </Button>
              )}
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

          {/* Phase 2: Enhanced Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="justify-between min-w-[140px]">
                  {sortBy === 'newest' && <><SortDesc className="w-4 h-4 mr-2" />Newest First</>}
                  {sortBy === 'oldest' && <><SortAsc className="w-4 h-4 mr-2" />Oldest First</>}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[160px]">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortBy('newest')}>
                  <SortDesc className="w-4 h-4 mr-2" />
                  Newest First
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                  <SortAsc className="w-4 h-4 mr-2" />
                  Oldest First
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Category Filter (only for entity photos) */}
            {activeTab === 'entity' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-between min-w-[120px]">
                    <Filter className="w-4 h-4 mr-2" />
                    {categoryFilter ? PHOTO_CATEGORIES.find(c => c.value === categoryFilter)?.label || categoryFilter : 'All Categories'}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[180px]">
                  <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCategoryFilter(null)}>
                    All Categories ({entityPhotos.length})
                  </DropdownMenuItem>
                  {PHOTO_CATEGORIES.map((category) => {
                    const count = getCategoryCounts[category.value] || 0;
                    return (
                      <DropdownMenuItem 
                        key={category.value} 
                        onClick={() => setCategoryFilter(category.value)}
                        disabled={count === 0}
                      >
                        {category.label} ({count})
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Active Filters */}
            {(categoryFilter || sortBy !== 'newest') && (
              <div className="flex items-center gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground h-6"
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                All ({allPhotos.length})
              </TabsTrigger>
              <TabsTrigger value="entity">
                User Photos ({entityPhotos.length})
                {categoryFilter && (
                  <Badge variant="outline" className="ml-1 text-xs">
                    {getCategoryCounts[categoryFilter] || 0}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="google">
                Google Places ({allPhotos.filter(p => p.source === 'google_places').length})
              </TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews ({allPhotos.filter(p => p.source === 'user_review').length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {getFilteredPhotos().map((photo, index) => (
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
                          <FileImage className="w-3 h-3" />
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
                              Edit Media
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
                              Delete Media
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
                            Report Media
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

          {/* Phase 2: Show More Button / Pagination */}
          {hasMorePhotos && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={loadMorePhotos}
                className="min-w-[120px]"
              >
                Show More ({getFilteredAndSortedPhotos.length - photosToShow} remaining)
              </Button>
            </div>
          )}

          {/* Results Info */}
          {getFilteredAndSortedPhotos.length > 0 && (
            <div className="text-center mt-4 text-sm text-muted-foreground">
              Showing {Math.min(photosToShow, getFilteredAndSortedPhotos.length)} of {getFilteredAndSortedPhotos.length} photos
              {(categoryFilter || sortBy !== 'newest') && (
                <span> • Filters applied</span>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      {/* Lightbox for full-screen viewing */}
      {selectedPhotoIndex !== null && (
        <PhotoLightbox
          photos={getFilteredAndSortedPhotos}
          currentIndex={selectedPhotoIndex}
          onClose={closeLightbox}
          onNext={() => setSelectedPhotoIndex((selectedPhotoIndex + 1) % getFilteredAndSortedPhotos.length)}
          onPrevious={() => setSelectedPhotoIndex((selectedPhotoIndex - 1 + getFilteredAndSortedPhotos.length) % getFilteredAndSortedPhotos.length)}
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
        title="Delete Media"
        description="Are you sure you want to delete this media? This action cannot be undone."
        isLoading={isDeletingPhoto}
      />

      {/* Entity Media Upload Modal */}
      {showEntityUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Add Media</h2>
                  <p className="text-sm text-muted-foreground">
                    Upload photos and videos to share with others
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEntityUpload(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <MediaUploader
                sessionId={`entity-${entity.id}-${Date.now()}`}
                onMediaUploaded={(mediaItem) => {
                  handleEntityMediaUploaded(mediaItem);
                  setShowEntityUpload(false);
                }}
                initialMedia={[]}
                className="w-full"
                maxMediaCount={5}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};