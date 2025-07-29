import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { EntityPhoto, updateEntityPhoto, PHOTO_CATEGORIES } from '@/services/entityPhotoService';
import { useToast } from '@/hooks/use-toast';

interface EntityPhotoEditModalProps {
  photo: EntityPhoto;
  isOpen: boolean;
  onClose: () => void;
  onPhotoUpdated: (updatedPhoto: EntityPhoto) => void;
}

export const EntityPhotoEditModal: React.FC<EntityPhotoEditModalProps> = ({
  photo,
  isOpen,
  onClose,
  onPhotoUpdated
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    caption: photo.caption || '',
    alt_text: photo.alt_text || '',
    category: photo.category
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await updateEntityPhoto(photo.id, formData);
      
      if (success) {
        const updatedPhoto: EntityPhoto = {
          ...photo,
          ...formData,
          updated_at: new Date().toISOString()
        };
        
        onPhotoUpdated(updatedPhoto);
        onClose();
        
        toast({
          title: "Photo updated",
          description: "Your photo has been updated successfully.",
        });
      } else {
        throw new Error('Failed to update photo');
      }
    } catch (error) {
      console.error('Error updating photo:', error);
      toast({
        title: "Error",
        description: "Failed to update photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Photo</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo preview */}
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={photo.url}
              alt={photo.alt_text || photo.caption || 'Photo'}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => handleInputChange('category', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {PHOTO_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              placeholder="Add a caption to your photo..."
              value={formData.caption}
              onChange={(e) => handleInputChange('caption', e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {formData.caption.length}/500
            </div>
          </div>

          {/* Alt text */}
          <div className="space-y-2">
            <Label htmlFor="alt_text">Alt Text</Label>
            <Input
              id="alt_text"
              placeholder="Describe what's in the photo for accessibility..."
              value={formData.alt_text}
              onChange={(e) => handleInputChange('alt_text', e.target.value)}
              maxLength={200}
            />
            <div className="text-xs text-muted-foreground">
              Help visually impaired users understand your photo
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Photo'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};