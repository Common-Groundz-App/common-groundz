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
   * Now routes ALL entities through the edge function to avoid CORS issues
   */
  const shouldUseEdgeFunction = (entity: any): boolean => {
    // Route all entities through the edge function for consistent behavior
    // and to avoid CORS issues with external URLs
    return true;
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
        photoReference: entity.metadata?.photo_reference,
        apiSource: 'google_places'
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
    
    // For all other entities (including products), use external image URL
    return {
      ...baseRequest,
      externalImageUrl: entity.image_url,
      apiSource: entity.api_source || 'external'
    };
  };

  /**
   * Refreshes an entity's image using specialized logic for different entity types
   * Google Places entities get fresh photo references, others use existing refresh logic
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

      // Get current session for edge function authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found for edge function authorization');
        throw new Error('Authentication required to refresh image');
      }

      let result;

      // Handle Google Places entities with fresh data fetch
      if (entity.api_source === 'google_places' && entity.api_ref) {
        console.log(`🔄 Refreshing Google Places entity with fresh data from API`);
        
        const response = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/refresh-google-places-entity`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            entityId: entity.id,
            placeId: entity.api_ref
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response from refresh-google-places-entity:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || 'Failed to refresh Google Places entity' };
          }
          throw new Error(errorData.error || 'Failed to refresh Google Places entity');
        }

        const refreshData = await response.json();
        console.log('Fresh Google Places data:', refreshData);

        if (!refreshData.success) {
          throw new Error(refreshData.error || 'Failed to get fresh Google Places data');
        }

        // Update entity with fresh metadata and new image URL
        const existingMetadata = entity.metadata && typeof entity.metadata === 'object' ? entity.metadata : {};
        const newMetadata = refreshData.updatedMetadata && typeof refreshData.updatedMetadata === 'object' ? refreshData.updatedMetadata : {};
        const updatedMetadata = { ...existingMetadata as Record<string, any>, ...newMetadata as Record<string, any> };

        const { error: updateError } = await supabase
          .from('entities')
          .update({
            image_url: refreshData.newImageUrl,
            metadata: updatedMetadata
          })
          .eq('id', entityId);

        if (updateError) {
          console.error('Error updating entity with fresh data:', updateError);
          throw new Error(`Failed to update entity: ${updateError.message}`);
        }

        result = { imageUrl: refreshData.newImageUrl };
        console.log('✅ Google Places entity refreshed with fresh data');
      } 
      // Handle all other entities using existing refresh logic
      else {
        console.log(`Using existing refresh logic for entity: ${entity.api_source || 'external'}`);
        
        // First, ensure the entity-images bucket has correct policies
        await ensureBucketPolicies('entity-images');
        
        // Prepare request data based on entity type
        const requestData = prepareEdgeFunctionRequest(entity);
        
        console.log(`Calling refresh-entity-image with data:`, requestData);
        
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

        result = await response.json();
        console.log('Successful edge function response:', result);
      }
      
      const imageUrl = result?.imageUrl;
      
      // Track successful refresh
      imagePerformanceService.trackImageStorage(
        'manual_refresh_success',
        entityId,
        imageUrl || '',
        startTime,
        true,
        undefined,
        { apiSource: entity.api_source, method: entity.api_source === 'google_places' ? 'google_places_refresh' : 'edge_function' }
      );

      console.log('Entity image refreshed successfully:', entityId);
      return imageUrl;
      
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
