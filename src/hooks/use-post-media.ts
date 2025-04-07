
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { uploadMultiplePostMedia, deletePostMedia } from '@/services/recommendation/postMediaUpload';

export type PostMedia = {
  url: string;
  type: 'image' | 'video';
  caption?: string;
  order: number;
};

export const usePostMedia = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * Handle multiple file uploads
   */
  const handleMediaUpload = async (files: File[], captions?: Record<string, string>) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to upload media',
        variant: 'destructive'
      });
      return false;
    }

    try {
      setIsUploading(true);

      // Validate file types
      const validFiles = files.filter(file => {
        const isValid = file.type.startsWith('image/') || file.type.startsWith('video/');
        if (!isValid) {
          toast({
            title: 'Invalid file type',
            description: `${file.name} is not an image or video file`,
            variant: 'destructive'
          });
        }
        return isValid;
      });

      // Validate file sizes (10MB limit for images, 50MB for videos)
      const filesToUpload = validFiles.filter(file => {
        const isVideo = file.type.startsWith('video/');
        const sizeLimit = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        const isValidSize = file.size <= sizeLimit;
        
        if (!isValidSize) {
          toast({
            title: 'File too large',
            description: `${file.name} exceeds the size limit (${isVideo ? '50MB' : '10MB'})`,
            variant: 'destructive'
          });
        }
        return isValidSize;
      });

      if (filesToUpload.length === 0) {
        setIsUploading(false);
        return false;
      }

      // Upload all valid files
      const uploadedMedia = await uploadMultiplePostMedia(user.id, filesToUpload, captions);
      
      // Update media state with new uploads
      setMedia(prev => {
        const updated = [...prev];
        
        // Add new media with order starting after the last existing item
        const startOrder = updated.length > 0 
          ? Math.max(...updated.map(m => m.order)) + 1 
          : 0;
        
        uploadedMedia.forEach((item, idx) => {
          updated.push({
            ...item,
            order: startOrder + idx
          });
        });
        
        // Sort by order
        return updated.sort((a, b) => a.order - b.order);
      });

      if (uploadedMedia.length > 0) {
        toast({
          title: 'Media uploaded',
          description: `${uploadedMedia.length} file(s) successfully uploaded`,
        });
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error uploading media:', err);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload media files. Please try again.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Remove a media item from the state
   * Optionally delete it from storage
   */
  const removeMedia = async (index: number, deleteFromStorage = false) => {
    const itemToRemove = media[index];
    if (!itemToRemove) return;

    // Remove from state
    setMedia(prev => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })));

    // Delete from storage if requested
    if (deleteFromStorage && user) {
      try {
        await deletePostMedia(user.id, itemToRemove.url);
      } catch (err) {
        console.error('Error deleting media from storage:', err);
      }
    }
  };

  /**
   * Update caption for a media item
   */
  const updateMediaCaption = (index: number, caption: string) => {
    setMedia(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, caption } : item
      )
    );
  };

  /**
   * Reorder media items
   */
  const reorderMedia = (from: number, to: number) => {
    if (from === to) return;

    setMedia(prev => {
      const newMedia = [...prev];
      const [movedItem] = newMedia.splice(from, 1);
      newMedia.splice(to, 0, movedItem);
      
      // Update order property for all items
      return newMedia.map((item, i) => ({ ...item, order: i }));
    });
  };

  return {
    media,
    setMedia,
    isUploading,
    handleMediaUpload,
    removeMedia,
    updateMediaCaption,
    reorderMedia
  };
};
