import React, { useState } from 'react';
import { MediaItem } from '@/types/media';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaUploader } from '@/components/media/MediaUploader';
import { CompactMediaGrid } from '@/components/media/CompactMediaGrid';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { PHOTO_CATEGORIES } from '@/services/entityPhotoService';
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
  const [category, setCategory] = useState('general');
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
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

    // Add metadata to media items
    const mediaWithMetadata = selectedMedia.map(item => ({
      ...item,
      caption: caption.trim() || undefined,
      alt: altText.trim() || undefined,
      category
    }));

    onSave(mediaWithMetadata);
    setSelectedMedia([]);
    setCaption('');
    setAltText('');
    setCategory('general');
    onClose();
    
    toast({
      title: 'Media added',
      description: `${selectedMedia.length} media item(s) added successfully.`,
    });
  };

  const handleCancel = () => {
    setSelectedMedia([]);
    setCaption('');
    setAltText('');
    setCategory('general');
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
          className={`max-w-2xl max-h-[90vh] overflow-y-auto ${isLightboxOpen ? 'pointer-events-none' : ''}`}
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
            <DialogTitle>
              Add Photos & Videos
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Media Preview Grid */}
            {selectedMedia.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  🖼️ Your media ({selectedMedia.length}/4)
                </Label>
                <CompactMediaGrid
                  media={selectedMedia}
                  onRemove={handleRemoveMedia}
                  onOpenLightbox={handleOpenLightbox}
                  maxVisible={4}
                  className="max-h-48"
                />
              </div>
            )}

            {/* Media Uploader */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">📸 Add photos & videos</Label>
              <MediaUploader
                onMediaUploaded={handleMediaUploaded}
                disabled={isUploading || selectedMedia.length >= 4}
                maxMediaCount={4}
                initialMedia={selectedMedia}
                sessionId={`entity-upload-${Date.now()}`}
              />
            </div>

            {/* Media Metadata Form */}
            {selectedMedia.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-sm font-medium">📝 Media Details</Label>
                
                {/* Category Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PHOTO_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Caption</Label>
                  <Textarea
                    placeholder="Add a caption for your media..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                {/* Alt Text */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Alt Text</Label>
                  <Input
                    placeholder="Describe the media for accessibility..."
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                  />
                </div>
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