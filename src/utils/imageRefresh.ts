
import { supabase } from '@/integrations/supabase/client';
import { ensureHttps } from '@/utils/urlUtils';

/**
 * Defers an entity image refresh operation to run in the background
 * after a delay, preventing blocking of the main application flow.
 * 
 * @param entityId The ID of the entity to refresh the image for
 * @returns void - this function runs asynchronously and doesn't return anything
 */
export const deferEntityImageRefresh = (entityId: string): void => {
  if (!entityId) {
    console.error('deferEntityImageRefresh: No entityId provided');
    return;
  }

  console.log(`Scheduling deferred image refresh for entity ${entityId} in 5 seconds`);
  
  // Use setTimeout to delay the execution by 5 seconds
  setTimeout(async () => {
    try {
      // Fetch the entity by ID
      const { data: entity, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error) {
        console.error(`Error fetching entity for image refresh: ${error.message}`);
        return;
      }

      if (!entity) {
        console.error(`Entity not found for image refresh: ${entityId}`);
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
    }
  }, 5000);
};
