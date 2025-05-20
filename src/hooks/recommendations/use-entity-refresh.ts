
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveExternalImageToStorage } from '@/utils/imageUtils';

export const useEntityImageRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const refreshEntityImage = async (entityId: string, placeId?: string, photoReference?: string): Promise<string | null> => {
    if (!entityId) {
      console.error('Entity ID is required to refresh image');
      return null;
    }

    setIsRefreshing(true);
    
    try {
      // For Google Places entities, use the edge function
      if (placeId) {
        const response = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/refresh-entity-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.auth.getSession()}`
          },
          body: JSON.stringify({
            placeId,
            photoReference,
            entityId
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to refresh entity image');
        }

        const { imageUrl, photoReference: newPhotoRef } = await response.json();
        
        // Update the photo_reference in the entity record
        if (newPhotoRef && newPhotoRef !== photoReference) {
          const { error: updateError } = await supabase
            .from('entities')
            .update({ photo_reference: newPhotoRef })
            .eq('id', entityId);
            
          if (updateError) {
            console.warn(`Error updating photo reference: ${updateError.message}`);
          }
        }
        
        toast({
          title: 'Image refreshed',
          description: 'The entity image has been successfully updated.'
        });

        return imageUrl;
      } 
      // For non-Google Places entities, retrieve current image and migrate it
      else {
        // Get current entity data
        const { data: entity, error } = await supabase
          .from('entities')
          .select('image_url')
          .eq('id', entityId)
          .single();

        if (error) {
          throw new Error(`Error fetching entity: ${error.message}`);
        }

        if (!entity?.image_url) {
          toast({
            title: 'No image to refresh',
            description: 'This entity does not have an image to refresh.',
            variant: 'destructive'
          });
          return null;
        }

        // Migrate the external image to our storage
        const newImageUrl = await saveExternalImageToStorage(entity.image_url, entityId);
        
        if (!newImageUrl) {
          throw new Error('Failed to save entity image to storage');
        }
        
        // Update the entity record with the new image URL
        const { error: updateError } = await supabase
          .from('entities')
          .update({ image_url: newImageUrl })
          .eq('id', entityId);
          
        if (updateError) {
          throw new Error(`Error updating entity: ${updateError.message}`);
        }

        toast({
          title: 'Image saved',
          description: 'The entity image has been saved to our storage.'
        });
        
        return newImageUrl;
      }
    } catch (error) {
      console.error('Error refreshing entity image:', error);
      
      toast({
        title: 'Error refreshing image',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive'
      });
      
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  // New function to check if entity image is stored in our storage
  const isEntityImageMigrated = (imageUrl?: string): boolean => {
    if (!imageUrl) return false;
    return imageUrl.includes('entity-images') || imageUrl.includes('storage.googleapis.com');
  };

  // New function to migrate a batch of entity images
  const migrateEntityImages = async (limit: number = 10): Promise<{ 
    success: number, 
    failed: number,
    total: number 
  }> => {
    try {
      setIsRefreshing(true);
      
      const response = await supabase.functions.invoke('migrate-entity-images', {
        body: { limit }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const result = response.data;
      
      toast({
        title: 'Image Migration Batch Complete',
        description: `Successfully migrated ${result.successful} of ${result.processed} images.`
      });
      
      return {
        success: result.successful,
        failed: result.failed,
        total: result.processed
      };
    } catch (error) {
      console.error('Error migrating entity images:', error);
      
      toast({
        title: 'Migration Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive'
      });
      
      return {
        success: 0,
        failed: 0,
        total: 0
      };
    } finally {
      setIsRefreshing(false);
    }
  };

  return { 
    refreshEntityImage, 
    isRefreshing, 
    isEntityImageMigrated,
    migrateEntityImages
  };
};
