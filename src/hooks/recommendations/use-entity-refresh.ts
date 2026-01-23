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
        placeId: (entity.metadata as any)?.place_id,
        photoReference: (entity.metadata as any)?.photo_reference,
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
      if (entity.api_source === 'google_places' && (entity.metadata as any)?.place_id) {
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
            placeId: (entity.metadata as any).place_id
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

        // Edge function already handles all database updates (image_url, stored_photo_urls, metadata)
        // Use stored URL from response if available, otherwise fall back to newImageUrl
        const storedUrl = refreshData.updatedMetadata?.stored_photo_urls?.[0]?.storedUrl;
        result = { imageUrl: storedUrl || refreshData.newImageUrl };
        console.log('✅ Google Places entity refreshed, using:', storedUrl ? 'permanent storage URL' : 'proxy fallback');
      } 
      // Handle Google Places entities WITHOUT place_id (special error handling)
      else if (entity.api_source === 'google_places' && !(entity.metadata as any)?.place_id) {
        console.log(`⚠️ Google Places entity missing place_id, checking photo_reference fallback`);
        
        const photoReference = (entity.metadata as any)?.photo_reference;
        if (!photoReference) {
          toast({
            title: "Image refresh failed",
            description: `This Google Places entity is missing both place_id and photo_reference. Please contact support to fix the entity data.`,
            variant: "destructive",
          });
          throw new Error('Google Places entity missing both place_id and photo_reference');
        }

        // Try to use the old photo reference but handle expired references gracefully
        console.log(`🔄 Trying to refresh with existing photo_reference (may be expired)`);
        
        const requestData = prepareEdgeFunctionRequest(entity);
        
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
          
          // Check if it's likely an expired photo reference error
          if (errorText.includes('expired') || errorText.includes('400') || errorText.includes('Bad Request')) {
            toast({
              title: "Image refresh failed",
              description: `This Google Places entity has an expired photo reference and is missing place_id. The entity needs to be updated with current Google Places data.`,
              variant: "destructive",
            });
            throw new Error('Google Places entity has expired photo reference and missing place_id');
          } else {
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || 'Failed to refresh entity image' };
            }
            throw new Error(errorData.error || 'Failed to refresh entity image');
          }
        }

        result = await response.json();
        console.log('✅ Google Places entity refreshed using fallback photo_reference');
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
