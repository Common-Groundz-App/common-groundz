
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { uploadRecommendationImage } from '@/services/recommendationService';
import { ensureHttps } from '@/utils/urlUtils';

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
      console.log('Image uploaded successfully:', imageUrl);
      
      // Ensure the URL uses HTTPS
      const secureUrl = imageUrl ? ensureHttps(imageUrl) : null;
      
      toast({
        title: 'Image uploaded',
        description: 'Image has been uploaded successfully'
      });
      
      return secureUrl;
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
  
  // Method to determine if an image URL is from an entity
  const isEntityImageUrl = (imageUrl: string | null): boolean => {
    if (!imageUrl) return false;
    
    // Check common patterns for entity images
    return (
      imageUrl.includes('googleapis.com') || 
      imageUrl.includes('unsplash.com') ||
      imageUrl.includes('placeholder.com') ||
      imageUrl.includes('external-image') ||
      imageUrl.includes('api.example.com')
    );
  };

  return {
    handleImageUpload,
    isEntityImageUrl
  };
};
