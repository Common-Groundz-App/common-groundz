import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { uploadRecommendationImage } from '@/services/recommendationService';

export const useRecommendationUploads = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to upload images',
        variant: 'destructive'
      });
      return null;
    }

    try {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file',
          variant: 'destructive'
        });
        return null;
      }

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Image size should be less than 5MB',
          variant: 'destructive'
        });
        return null;
      }

      // Upload image
      const imageUrl = await uploadRecommendationImage(user.id, file);
      
      toast({
        title: 'Image uploaded',
        description: 'Image has been uploaded successfully'
      });
      
      return imageUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    handleImageUpload
  };
};
