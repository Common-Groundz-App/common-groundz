import React, { useState } from 'react';
import { MediaItem } from '@/types/media';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MediaUploader } from '@/components/media/MediaUploader';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { useToast } from '@/hooks/use-toast';
import { Plus, X } from 'lucide-react';

interface SimpleMediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (media: MediaItem[]) => void;
}

export function SimpleMediaUploadModal({
  isOpen,
  onClose,
  onSave
}: SimpleMediaUploadModalProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const { toast } = useToast();

  const handleMediaUploaded = (mediaItem: MediaItem) => {
    setSelectedMedia(prev => [
      ...prev,
      {
        ...mediaItem,
        order: prev.length,
        id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID for local state
      }
    ]);
  };

  const handleRemoveMedia = (mediaToRemove: MediaItem) => {
    setSelectedMedia(prev => 
      prev.filter(item => item.id !== mediaToRemove.id)
        .map((item, index) => ({ ...item, order: index }))
    );
  };

  const handleOpenLightbox = (index: number) => {
    setSelectedMediaIndex(index);
    setIsLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
  };

  const handleSave = () => {
    if (selectedMedia.length === 0) {
      toast({
        title: 'No media selected',
        description: 'Please add at least one photo or video.',
        variant: 'destructive'
      });
      return;
    }

    onSave(selectedMedia);
    setSelectedMedia([]);
    onClose();
    
    toast({
      title: 'Media added',
      description: `${selectedMedia.length} media item(s) added successfully.`,
    });
  };

  const handleCancel = () => {
    setSelectedMedia([]);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        // Only allow closing the dialog if lightbox is not open
        if (!isLightboxOpen && !open) {
          onClose();
        }
      }}>
        <DialogOverlay 
          className={isLightboxOpen ? "pointer-events-none" : ""}
        />
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => {
            // Prevent closing when clicking on lightbox elements
            const target = e.target as Element;
            if (target.closest('[data-lightbox="true"]') || target.closest('.lightbox-preview')) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            // If lightbox is open, let it handle the escape key
            if (isLightboxOpen) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={20} />
              Add Photos & Videos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Media Uploader */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Upload Media</h3>
              <MediaUploader
                onMediaUploaded={handleMediaUploaded}
                disabled={isUploading}
                maxMediaCount={20}
                sessionId={`entity-upload-${Date.now()}`}
              />
            </div>

            {/* Media Preview Grid */}
            {selectedMedia.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">
                  Selected Media ({selectedMedia.length})
                </h3>
                <CompactMediaGrid
                  media={selectedMedia}
                  onRemove={handleRemoveMedia}
                  onOpenLightbox={handleOpenLightbox}
                  maxVisible={8}
                  className="max-h-48"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isUploading || selectedMedia.length === 0}
              >
                Add Media ({selectedMedia.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox for media preview */}
      {isLightboxOpen && selectedMedia.length > 0 && (
        <LightboxPreview
          media={selectedMedia}
          initialIndex={selectedMediaIndex}
          onClose={handleCloseLightbox}
        />
      )}
    </>
  );
}