
import { supabase } from '@/integrations/supabase/client';
import { ensureHttps } from '@/utils/urlUtils';

/**
 * Defers an entity image refresh operation to run in the background
 * after a delay, preventing blocking of the main application flow.
 * 
 * @param entityId The ID of the entity to refresh the image for
 * @param retryCount Optional retry count, used internally for exponential backoff
 * @returns void - this function runs asynchronously and doesn't return anything
 */
export const deferEntityImageRefresh = (entityId: string, retryCount: number = 0): void => {
  if (!entityId) {
    console.error('deferEntityImageRefresh: No entityId provided');
    return;
  }

  const maxRetries = 3;
  const baseDelay = 5000; // 5 seconds initial delay
  const delay = retryCount === 0 ? baseDelay : Math.min(baseDelay * Math.pow(2, retryCount), 30000);
  
  console.log(`Scheduling deferred image refresh for entity ${entityId} in ${delay/1000} seconds (attempt ${retryCount + 1})`);
  
  // Use setTimeout to delay the execution by the calculated delay
  setTimeout(async () => {
    try {
      // Fetch the entity by ID using maybeSingle() instead of single() to prevent 406 errors
      const { data: entity, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .eq('is_deleted', false)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching entity for image refresh: ${error.message}`);
        
        // If we haven't exceeded max retries, try again with exponential backoff
        if (retryCount < maxRetries) {
          console.log(`Retrying entity image refresh for ${entityId} (attempt ${retryCount + 2})`);
          deferEntityImageRefresh(entityId, retryCount + 1);
        }
        return;
      }

      if (!entity) {
        console.log(`Entity not found for image refresh: ${entityId}. This might be due to a race condition.`);
        
        // If entity is not found and we haven't exceeded max retries, try again
        if (retryCount < maxRetries) {
          console.log(`Retrying entity image refresh for ${entityId} (attempt ${retryCount + 2})`);
          deferEntityImageRefresh(entityId, retryCount + 1);
        }
        return;
      }

      // Check if this is a Google Places entity with an API reference
      if (entity.api_source === 'google_places' && entity.api_ref) {
        console.log(`Starting background image refresh for Google Places entity: ${entityId}`);
        
        // Get current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No active session found for edge function authorization');
          return;
        }

        // Prepare the data for the edge function
        // Use type assertion for the metadata to access photo_reference
        const photoReference = entity.metadata && typeof entity.metadata === 'object' 
          ? (entity.metadata as Record<string, any>).photo_reference 
          : undefined;
        const placeId = entity.api_ref;

        // Call the refresh-entity-image edge function
        console.log(`Calling refresh-entity-image edge function for entity ${entityId} with:`, { placeId, photoReference });
        
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
          console.error(`Error from refresh-entity-image edge function: ${response.status} ${response.statusText}`, errorText);
          
          // If we get a server error (5xx) and haven't exceeded max retries, try again
          if (response.status >= 500 && retryCount < maxRetries) {
            console.log(`Server error, retrying entity image refresh for ${entityId} (attempt ${retryCount + 2})`);
            deferEntityImageRefresh(entityId, retryCount + 1);
          }
          return;
        }

        const responseData = await response.json();
        console.log('Background image refresh successful:', responseData);
        
        // Note: We don't update the entity here as the edge function already does that
      } else {
        console.log(`Entity ${entityId} is not a Google Places entity or has no API reference. Skipping automatic image refresh.`);
      }
    } catch (error) {
      console.error('Error in deferred entity image refresh:', error);
      
      // If we haven't exceeded max retries, try again for unexpected errors
      if (retryCount < maxRetries) {
        console.log(`Exception occurred, retrying entity image refresh for ${entityId} (attempt ${retryCount + 2})`);
        deferEntityImageRefresh(entityId, retryCount + 1);
      }
    }
  }, delay);
};
