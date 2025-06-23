import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveExternalImageToStorage } from '@/utils/imageUtils';
import { ensureBucketPolicies } from '@/services/storageService';
import { triggerBatchEntityImageRefresh } from '@/utils/imageRefresh';
import { imagePerformanceService } from '@/services/imagePerformanceService';

export const useEntityImageRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  /**
   * Extracts the original URL from a proxy URL, but keeps Google Books proxy URLs intact
   * since we need to use the proxy for downloading due to CORS restrictions
   */
  const extractOriginalUrl = (proxyUrl: string): string => {
    try {
      const url = new URL(proxyUrl);
      
      // For Google Books proxy URLs, keep using the proxy URL for downloading
      if (proxyUrl.includes('/functions/v1/proxy-google-books')) {
        return proxyUrl;
      }
      
      // For other proxy URLs, extract the original URL
      const originalUrl = url.searchParams.get('url');
      return originalUrl ? decodeURIComponent(originalUrl) : proxyUrl;
    } catch {
      return proxyUrl;
    }
  };

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
    const startTime = Date.now();
    
    try {
      console.log(`Starting image refresh for entity ${entityId}`, { placeId, photoReference });
      
      // Track the refresh attempt
      imagePerformanceService.trackImageStorage(
        'manual_refresh_start',
        entityId,
        '',
        startTime,
        true,
        undefined,
        { placeId, photoReference }
      );
      
      // First, ensure the entity-images bucket has correct policies
      await ensureBucketPolicies('entity-images');
      
      // For Google Places entities, use the edge function
      if (placeId) {
        console.log(`Refreshing Google Places image for entity ${entityId} with place ID ${placeId}`);
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No active session found for edge function authorization');
          throw new Error('Authentication required to refresh image');
        }
        
        const response = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/refresh-entity-image`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            entityId,
            placeId,
            photoReference
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response from refresh-entity-image:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || 'Failed to refresh entity image' };
          }
          throw new Error(errorData.error || 'Failed to refresh entity image');
        }

        const responseData = await response.json();
        console.log('Successful image refresh response:', responseData);
        
        const { imageUrl, photoReference: newPhotoRef } = responseData;
        
        // Update the photo_reference in the entity record
        if (newPhotoRef && newPhotoRef !== photoReference) {
          const { error: updateError } = await supabase
            .from('entities')
            .update({ 
              metadata: {
                photo_reference: newPhotoRef
              }
            })
            .eq('id', entityId);
            
          if (updateError) {
            console.warn(`Error updating photo reference: ${updateError.message}`);
          }
        }
        
        // Track successful refresh
        imagePerformanceService.trackImageStorage(
          'manual_refresh_success',
          entityId,
          imageUrl,
          startTime,
          true,
          undefined,
          { placeId, newPhotoRef }
        );

        console.log('Google Places image refreshed successfully for entity:', entityId);
        return imageUrl;
      } 
      // For non-Google Places entities, retrieve current image and migrate it
      else {
        // Get current entity data
        const { data: entity, error } = await supabase
          .from('entities')
          .select('image_url, name')
          .eq('id', entityId)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error(`Error fetching entity: ${error.message}`);
          throw new Error(`Error fetching entity: ${error.message}`);
        }

        if (!entity?.image_url) {
          console.warn('No image URL found for entity:', entityId);
          throw new Error('No image URL found for this entity');
        }

        // Check if the image is already stored in our storage (only true storage URLs)
        if (isEntityImageMigrated(entity.image_url)) {
          console.log('Image already saved in storage:', entity.image_url);
          
          // Track as already migrated
          imagePerformanceService.trackImageStorage(
            'already_migrated',
            entityId,
            entity.image_url,
            startTime,
            true,
            undefined,
            { entityName: entity.name }
          );
          
          throw new Error('Image is already stored in local storage');
        }

        // For Google Books proxy URLs, use the proxy URL directly for downloading
        // For other proxy URLs, extract the original URL
        const urlToUse = extractOriginalUrl(entity.image_url);
        console.log(`Migrating image to storage for entity ${entityId}. URL to use: ${urlToUse}`);

        // Migrate the image to our storage
        const newImageUrl = await saveExternalImageToStorage(urlToUse, entityId);
        
        if (!newImageUrl || newImageUrl === entity.image_url) {
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
        }

        // Track successful migration
        imagePerformanceService.trackImageStorage(
          'migration_success',
          entityId,
          newImageUrl,
          startTime,
          true,
          undefined,
          { originalUrl: entity.image_url, entityName: entity.name }
        );

        console.log(`Image migrated successfully for "${entity.name}"`);
        return newImageUrl;
      }
    } catch (error: any) {
      console.error('Error refreshing entity image:', error);
      
      // Track failed refresh
      imagePerformanceService.trackImageStorage(
        'manual_refresh_failed',
        entityId,
        '',
        startTime,
        false,
        error.message,
        { placeId, photoReference }
      );
      
      // Show appropriate error message to user
      toast({
        title: 'Image Refresh Failed',
        description: error.message || 'An unexpected error occurred while refreshing the image.',
        variant: 'destructive'
      });
      
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Initiates a batch refresh of Google Places entity images.
   * This is an admin-only function that requires an API key.
   *
   * @param apiKey The secret API key for authenticating with the edge function
   * @param options Configuration options for the batch refresh
   * @returns Statistics about the refresh operation
   */
  const refreshBatchEntityImages = async (
    apiKey: string,
    options: {
      batchSize?: number;
      maxRetries?: number;
      dryRun?: boolean;
      enableHealthCheck?: boolean;
      forceRefresh?: boolean;
    } = {}
  ) => {
    setIsRefreshing(true);
    
    try {
      const result = await triggerBatchEntityImageRefresh(apiKey, options);
      
      toast({
        title: 'Batch refresh completed',
        description: `Processed ${result.processed} entities: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped. Health checked: ${result.healthChecked}, broken found: ${result.brokenImagesFound}.`
      });
      
      return result;
    } catch (error: any) {
      console.error('Error in batch entity image refresh:', error);
      
      toast({
        title: 'Batch refresh failed',
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
   * Only returns true for actual storage URLs, not proxy URLs
   * 
   * @param imageUrl The image URL to check
   * @returns True if the image is stored in our system, false otherwise
   */
  const isEntityImageMigrated = (imageUrl?: string): boolean => {
    if (!imageUrl) return false;
    
    // Check for actual storage URLs (not proxy URLs)
    const isStorageUrl = imageUrl.includes('entity-images') && 
                        (imageUrl.includes('storage.googleapis.com') || imageUrl.includes('supabase.co/storage'));
    
    // Proxy URLs should be considered "not migrated"
    const isProxyUrl = imageUrl.includes('/functions/v1/proxy-') || 
                      imageUrl.includes('supabase.co/functions/v1/proxy-');
    
    return isStorageUrl && !isProxyUrl;
  };

  return { 
    refreshEntityImage, 
    refreshBatchEntityImages,
    isRefreshing, 
    isEntityImageMigrated
  };
};
