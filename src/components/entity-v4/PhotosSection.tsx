import React, { useState } from 'react';
import { Camera, Flag, ExternalLink, User, Calendar, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Entity } from '@/services/recommendation/types';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { PhotoReportModal } from '@/components/ui/photo-report-modal';
import { PhotoWithMetadata } from '@/services/photoService';
import { usePhotoCache } from '@/hooks/usePhotoCache';
import { useAuth } from '@/contexts/AuthContext';


interface PhotosSectionProps {
  entity: Entity;
}

export const PhotosSection: React.FC<PhotosSectionProps> = ({ entity }) => {
  const { user } = useAuth();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [reportModalPhoto, setReportModalPhoto] = useState<PhotoWithMetadata | null>(null);

  const {
    photos,
    isLoading: loading,
    isCaching,
    hasMore,
    loadMore,
    refreshCache,
    cacheProgress
  } = usePhotoCache({
    entityId: entity.id,
    entity: entity, // Pass entity data for photo fetching
    initialLoadCount: 8,
    enableBackgroundCaching: true
  });

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

  if (photos.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Camera className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Photos & Videos</h3>
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
              <span className="text-sm text-muted-foreground">({photos.length})</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Cache progress indicator */}
              {isCaching && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    Caching {cacheProgress.cached}/{cacheProgress.total}
                  </span>
                </div>
              )}
              
              {/* Refresh button */}
              <Button
                size="sm"
                variant="outline"
                onClick={refreshCache}
                disabled={loading || isCaching}
                className="h-8"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {photos.map((photo, index) => (
              <div
                key={`${photo.source}-${index}`}
                className="relative group aspect-square overflow-hidden rounded-lg cursor-pointer bg-muted"
                onClick={() => handlePhotoClick(index)}
              >
                <img
                  src={photo.url}
                  alt={photo.alt || entity.name}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Photo overlay with metadata */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-1 text-white text-xs">
                      {photo.source === 'google_places' ? (
                        <>
                          <ExternalLink className="w-3 h-3" />
                          <span>Google</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3" />
                          <span>{photo.username || 'User'}</span>
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReportPhoto(photo);
                      }}
                      className="h-6 w-6 p-0 text-white hover:bg-red-500/20"
                    >
                      <Flag className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {photo.createdAt && (
                      <div className="flex items-center gap-1 text-white text-xs">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(photo.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {/* Cached indicator */}
                    {(photo as any).isCached && (
                      <div className="flex items-center gap-1 text-white text-xs bg-green-600/80 px-2 py-1 rounded-full">
                        <Download className="w-3 h-3" />
                        <span>Cached</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-6">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Load More Photos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox for full-screen viewing */}
      {selectedPhotoIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={selectedPhotoIndex}
          onClose={closeLightbox}
          onNext={() => setSelectedPhotoIndex((selectedPhotoIndex + 1) % photos.length)}
          onPrevious={() => setSelectedPhotoIndex((selectedPhotoIndex - 1 + photos.length) % photos.length)}
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
    </>
  );
};