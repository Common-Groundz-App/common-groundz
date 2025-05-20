
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveExternalImageToStorage } from '@/utils/imageUtils';

export const useEntityImageRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  /**
   * Refreshes an entity's image by either fetching a new Google Places image
   * or downloading the existing external URL to our storage.
   * 
   * @param entityId The ID of the entity
   * @param placeId Optional Google Places ID for Google Places entities
   * @param photoReference Optional photo reference for Google Places images
   * @returns The URL of the refreshed image or null if the refresh failed
   */
  const refreshEntityImage = async (entityId: string, placeId?: string, photoReference?: string): Promise<string | null> => {
    if (!entityId) {
      console.error('Entity ID is required to refresh image');
      return null;
    }

    setIsRefreshing(true);
    
    try {
      // For Google Places entities, use the edge function
      if (placeId) {
        console.log(`Refreshing Google Places image for entity ${entityId} with place ID ${placeId}`);
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
          title: 'Google Places image refreshed',
          description: 'The entity image has been successfully updated from Google Places.'
        });

        return imageUrl;
      } 
      // For non-Google Places entities, retrieve current image and migrate it
      else {
        // Get current entity data
        const { data: entity, error } = await supabase
          .from('entities')
          .select('image_url, name')
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

        // Check if the image is already stored in our storage
        if (isEntityImageMigrated(entity.image_url)) {
          toast({
            title: 'Image already saved',
            description: 'This image is already stored securely in our system.',
          });
          return entity.image_url;
        }

        console.log(`Migrating external image to storage for entity ${entityId}: ${entity.image_url}`);

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
          title: 'Image saved locally',
          description: `The image for "${entity.name}" has been saved to our secure storage.`
        });
        
        return newImageUrl;
      }
    } catch (error: any) {
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

  /**
   * Checks if an entity image is stored in our storage system
   * 
   * @param imageUrl The image URL to check
   * @returns True if the image is stored in our system, false otherwise
   */
  const isEntityImageMigrated = (imageUrl?: string): boolean => {
    if (!imageUrl) return false;
    return imageUrl.includes('entity-images') || imageUrl.includes('storage.googleapis.com');
  };

  return { 
    refreshEntityImage, 
    isRefreshing, 
    isEntityImageMigrated
  };
};
