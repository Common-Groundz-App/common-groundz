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
   * Determines if an entity should use the edge function for image refresh
   * based on its API source and metadata
   */
  const shouldUseEdgeFunction = (entity: any): boolean => {
    // Google Places entities
    if (entity.api_source === 'google_places' && entity.api_ref) {
      return true;
    }
    
    // Google Books entities
    if (entity.api_source === 'google_books' && entity.metadata?.google_books_id) {
      return true;
    }
    
    // OpenLibrary entities
    if (entity.api_source === 'openlibrary' && entity.metadata?.openlibrary_id) {
      return true;
    }
    
    // Movie entities (TMDB)
    if (entity.api_source === 'tmdb' && entity.metadata?.tmdb_id) {
      return true;
    }
    
    // Movie entities (OMDb)
    if (entity.api_source === 'omdb' && entity.metadata?.imdb_id) {
      return true;
    }
    
    return false;
  };

  /**
   * Prepares the request data for the edge function based on entity type and metadata
   */
  const prepareEdgeFunctionRequest = (entity: any) => {
    const baseRequest = { entityId: entity.id };
    
    // Google Places
    if (entity.api_source === 'google_places') {
      return {
        ...baseRequest,
        placeId: entity.api_ref,
        photoReference: entity.metadata?.photo_reference
      };
    }
    
    // Google Books
    if (entity.api_source === 'google_books') {
      return {
        ...baseRequest,
        googleBooksId: entity.metadata?.google_books_id,
        apiSource: 'google_books'
      };
    }
    
    // TMDB Movies
    if (entity.api_source === 'tmdb') {
      return {
        ...baseRequest,
        tmdbId: entity.metadata?.tmdb_id,
        apiSource: 'tmdb'
      };
    }
    
    // OMDb Movies
    if (entity.api_source === 'omdb') {
      return {
        ...baseRequest,
        omdbId: entity.metadata?.imdb_id,
        apiSource: 'omdb'
      };
    }
    
    // For other API sources or fallback, use external image URL
    return {
      ...baseRequest,
      externalImageUrl: entity.image_url,
      apiSource: entity.api_source
    };
  };

  /**
   * Refreshes an entity's image using the unified edge function approach
   * for API-sourced entities or direct storage migration for external URLs
   */
  const refreshEntityImage = async (entityId: string, placeId?: string, photoReference?: string): Promise<string | null> => {
    if (!entityId) {
      console.error('Entity ID is required to refresh image');
      return null;
    }

    setIsRefreshing(true);
    const startTime = Date.now();
    
    try {
      console.log(`Starting image refresh for entity ${entityId}`);
      
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
      
      // Get entity data to determine refresh strategy
      const { data: entity, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching entity: ${error.message}`);
        throw new Error(`Error fetching entity: ${error.message}`);
      }

      if (!entity) {
        console.warn('Entity not found:', entityId);
        throw new Error('Entity not found');
      }

      // Check if this entity should use the edge function
      if (shouldUseEdgeFunction(entity)) {
        console.log(`Using edge function for API-sourced entity: ${entity.api_source}`);
        
        // Get current session for edge function authorization
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No active session found for edge function authorization');
          throw new Error('Authentication required to refresh image');
        }
        
        // Prepare request data based on entity type
        const requestData = prepareEdgeFunctionRequest(entity);
        
        console.log(`Calling edge function with data:`, requestData);
        
        const response = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/refresh-entity-image`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(requestData)
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
        console.log('Successful edge function response:', responseData);
        
        const { imageUrl } = responseData;
        
        // Track successful refresh
        imagePerformanceService.trackImageStorage(
          'manual_refresh_success',
          entityId,
          imageUrl,
          startTime,
          true,
          undefined,
          { apiSource: entity.api_source, method: 'edge_function' }
        );

        console.log('API entity image refreshed successfully:', entityId);
        return imageUrl;
      } 
      // For non-API entities, use direct storage migration
      else {
        console.log(`Using direct storage migration for non-API entity: ${entityId}`);
        
        if (!entity.image_url) {
          console.warn('No image URL found for entity:', entityId);
          throw new Error('No image URL found for this entity');
        }

        // Check if the image is already stored in our storage
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

        console.log(`Migrating external image to storage for entity ${entityId}`);

        // Migrate the image to our storage
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
