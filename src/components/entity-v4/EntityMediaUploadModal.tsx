import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaItem } from '@/types/media';
import { uploadEntityMedia } from '@/services/entityMediaService';
import { EntityPhoto, PHOTO_CATEGORIES } from '@/services/entityPhotoService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface EntityMediaUploadModalProps {
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
  onMediaUploaded: (photo: EntityPhoto) => void;
}

export const EntityMediaUploadModal: React.FC<EntityMediaUploadModalProps> = ({
  entityId,
  isOpen,
  onClose,
  onMediaUploaded
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [uploadedMedia, setUploadedMedia] = useState<MediaItem[]>([]);
  const [category, setCategory] = useState('general');
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setUploadedMedia([]);
    setCategory('general');
    setCaption('');
    setAltText('');
    setIsUploading(false);
  };

  const handleClose = () => {
    if (!isUploading) {
      resetForm();
      onClose();
    }
  };

  const handleMediaUploaded = (mediaItem: MediaItem) => {
    setUploadedMedia([mediaItem]);
  };

  const handleSubmit = async () => {
    if (!uploadedMedia.length || !user?.id) return;

    setIsUploading(true);
    try {
      const mediaItem = uploadedMedia[0];
      const result = await uploadEntityMedia(
        mediaItem,
        entityId,
        user.id,
        category,
        caption || undefined,
        altText || undefined
      );

      if (result.success && result.photo) {
        onMediaUploaded(result.photo);
        toast({
          title: "Media uploaded",
          description: "Your photo or video has been added successfully"
        });
        handleClose();
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
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Photo or Video</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Media Uploader */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Upload Media
            </Label>
            <MediaUploader
              sessionId={`entity-upload-${entityId}-${Date.now()}`}
              onMediaUploaded={handleMediaUploaded}
              initialMedia={uploadedMedia}
              maxMediaCount={1}
              className="w-full"
            />
          </div>

          {/* Form Fields - Only show if media is uploaded */}
          {uploadedMedia.length > 0 && (
            <>
              {/* Category */}
              <div>
                <Label htmlFor="category" className="text-sm font-medium mb-2 block">
                  Category
                </Label>
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
              <div>
                <Label htmlFor="caption" className="text-sm font-medium mb-2 block">
                  Caption
                </Label>
                <Textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption for your media..."
                  rows={3}
                />
              </div>

              {/* Alt Text */}
              <div>
                <Label htmlFor="altText" className="text-sm font-medium mb-2 block">
                  Alt Text
                </Label>
                <Input
                  id="altText"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the content for accessibility..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  disabled={isUploading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isUploading}
                  className="flex-1"
                >
                  {isUploading ? "Uploading..." : "Upload Media"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};