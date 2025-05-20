
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveExternalImageToStorage } from '@/utils/imageUtils';
import { ensureBucketPolicies } from '@/services/storageService';

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
      console.log(`Starting image refresh for entity ${entityId}`, {
        entityId, 
        placeId: placeId || 'null', 
        photoReference: photoReference || 'null'
      });
      
      // First, ensure the entity-images bucket has correct policies
      await ensureBucketPolicies('entity-images');
      
      // For Google Places entities, use the edge function
      if (placeId || photoReference) {
        console.log(`Refreshing Google Places image for entity ${entityId} with place ID ${placeId || 'N/A'} and photo reference ${photoReference || 'N/A'}`);
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No active session found for edge function authorization');
          throw new Error('Authentication required to refresh image');
        }
        
        // Use supabase.functions.invoke for better integration and error handling
        const { data, error } = await supabase.functions.invoke('refresh-entity-image', {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: {
            placeId,
            photoReference,
            entityId
          }
        });

        if (error) {
          console.error('Error response from refresh-entity-image:', error);
          throw new Error(error.message || 'Failed to refresh entity image');
        }

        if (!data) {
          console.error('No data returned from refresh-entity-image');
          throw new Error('No response data from image refresh service');
        }
        
        console.log('Successful image refresh response:', data);
        
        const { imageUrl, photoReference: newPhotoRef } = data;
        
        if (!imageUrl) {
          throw new Error('No image URL returned from image refresh service');
        }
        
        // Update the photo_reference in the entity record if we got a new one
        if (newPhotoRef && newPhotoRef !== photoReference) {
          console.log('Updating entity with new photo reference:', newPhotoRef);
          
          // First fetch entity to get current metadata
          const { data: entity, error: entityError } = await supabase
            .from('entities')
            .select('metadata')
            .eq('id', entityId)
            .single();
            
          if (!entityError && entity) {
            const currentMetadata = typeof entity.metadata === 'object' ? entity.metadata || {} : {};
            
            // Update metadata with new photo reference
            const { error: updateError } = await supabase
              .from('entities')
              .update({ 
                metadata: {
                  ...currentMetadata,
                  photo_reference: newPhotoRef
                }
              })
              .eq('id', entityId);
              
            if (updateError) {
              console.warn(`Error updating photo reference: ${updateError.message}`);
            } else {
              console.log('Successfully updated entity metadata with new photo reference');
            }
          }
        }
        
        // Now update the image_url regardless of photo reference update
        const { error: imageUpdateError } = await supabase
          .from('entities')
          .update({ image_url: imageUrl })
          .eq('id', entityId);
          
        if (imageUpdateError) {
          console.error('Error updating entity image URL:', imageUpdateError);
          // We'll still return the URL even if the update failed
        } else {
          console.log('Successfully updated entity with new image URL:', imageUrl);
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
          console.error(`Error fetching entity: ${error.message}`);
          throw new Error(`Error fetching entity: ${error.message}`);
        }

        if (!entity?.image_url) {
          console.warn('No image URL found for entity:', entityId);
          toast({
            title: 'No image to refresh',
            description: 'This entity does not have an image to refresh.',
            variant: 'destructive'
          });
          return null;
        }

        // Check if the image is already stored in our storage
        if (isEntityImageMigrated(entity.image_url)) {
          console.log('Image already saved in storage:', entity.image_url);
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
          console.error('Failed to save entity image to storage');
          throw new Error('Failed to save entity image to storage');
        }
        
        console.log('Image saved successfully, updating entity record with new URL:', newImageUrl);
        
        // Update the entity record with the new image URL
        const { error: updateError } = await supabase
          .from('entities')
          .update({ image_url: newImageUrl })
          .eq('id', entityId);
          
        if (updateError) {
          console.error(`Error updating entity: ${updateError.message}`);
          throw new Error(`Error updating entity: ${updateError.message}`);
        } else {
          console.log('Successfully updated entity with new image URL');
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
