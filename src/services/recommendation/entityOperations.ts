
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from './types';
import { EntityTypeString, mapStringToEntityType, mapEntityTypeToString } from '@/hooks/feed/api/types';
import { getEntityTypeFallbackImage } from '@/utils/urlUtils';
import { shouldDownloadImage } from '@/utils/imageUtils';
import { downloadAndStoreEntityImage } from '@/services/mediaService';

// Fetch an entity by its ID
export const fetchEntityById = async (entityId: string): Promise<Entity | null> => {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', entityId)
    .eq('is_deleted', false)
    .single();

  if (error) {
    console.error('Error fetching entity:', error);
    return null;
  }

  return data as Entity;
};

// Find an entity by api_source and api_ref
export const findEntityByApiRef = async (apiSource: string, apiRef: string): Promise<Entity | null> => {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('api_source', apiSource)
    .eq('api_ref', apiRef)
    .eq('is_deleted', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found, return null
      return null;
    }
    console.error('Error finding entity by api ref:', error);
    return null;
  }

  return data as Entity;
};

// Update entity image using the original API source
export const refreshEntityImage = async (entityId: string): Promise<boolean> => {
  try {
    // First, fetch the entity
    const entity = await fetchEntityById(entityId);
    if (!entity) {
      console.error('Entity not found for refreshing image:', entityId);
      return false;
    }

    // For Google Places entities, fetch fresh photo from the API
    if (entity.api_source === 'google_places' && entity.api_ref) {
      // Log the current image state
      console.log('Current image URL:', entity.image_url);
      console.log('Is using fallback?', entity.image_url?.includes('unsplash.com'));
      
      // Check if photo_reference exists in metadata
      const photoReference = entity.metadata?.photo_reference;
      console.log('Photo reference from metadata:', photoReference);
      
      if (!photoReference) {
        console.log('No photo reference found in metadata, fetching from API...');
        
        // Fetch a new photo reference from the Google Places API
        try {
          const result = await supabase.functions.invoke('refresh-entity-image', {
            body: {
              placeId: entity.api_ref
            }
          });
          
          if (result.error) {
            console.error('Error fetching photo reference:', result.error);
            return false;
          }
          
          if (!result.data?.photoReference) {
            console.error('No photo reference found for this place');
            return false;
          }
          
          // Directly use the download-google-photo function with the new photo reference
          return await downloadGooglePhoto(entity.id, entity.api_ref, result.data.photoReference);
          
        } catch (invokeError) {
          console.error('Error invoking refresh-entity-image function:', invokeError);
          return false;
        }
      } else {
        // Use existing photo reference to download the image
        console.log('Using existing photo reference:', photoReference);
        return await downloadGooglePhoto(entity.id, entity.api_ref, photoReference);
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in refreshEntityImage:', error);
    return false;
  }
};

// Helper function to download Google photo using the download-google-photo edge function
const downloadGooglePhoto = async (entityId: string, placeId: string, photoRef: string): Promise<boolean> => {
  try {
    console.log(`Calling download-google-photo with placeId: ${placeId}, photoRef: ${photoRef}`);
    
    const result = await supabase.functions.invoke('download-google-photo', {
      body: {
        placeId: placeId,
        photoRef: photoRef
      }
    });
    
    if (result.error) {
      console.error('Error calling download-google-photo function:', result.error);
      return false;
    }
    
    console.log('download-google-photo response:', result);
    
    if (!result.data?.publicUrl) {
      console.error('No public URL returned from download-google-photo function');
      return false;
    }
    
    const storedImageUrl = result.data.publicUrl;
    console.log('Successfully stored image to Supabase:', storedImageUrl);
    
    // Fetch the entity again to ensure we have the latest data before updating
    const entityToUpdate = await fetchEntityById(entityId);
    if (!entityToUpdate) {
      console.error('Could not find entity to update with new image URL');
      return false;
    }
    
    // Update the entity with the new image URL
    const { error: updateError } = await supabase
      .from('entities')
      .update({ 
        image_url: storedImageUrl,
        metadata: { ...entityToUpdate.metadata, photo_reference: photoRef }
      })
      .eq('id', entityId);

    if (updateError) {
      console.error('Error updating entity image URL:', updateError);
      return false;
    }

    console.log('Successfully updated entity with new image URL');
    return true;
  } catch (downloadError) {
    console.error('Error downloading Google photo:', downloadError);
    return false;
  }
};

// Create a new entity
export const createEntity = async (entity: Omit<Entity, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>): Promise<Entity | null> => {
  // Convert EntityType enum to string for database compatibility
  let typeAsString: string;
  
  if (typeof entity.type === 'string') {
    typeAsString = entity.type;
  } else {
    typeAsString = mapEntityTypeToString(entity.type as EntityType);
  }
  
  // Ensure we have a valid image URL or use fallback based on type
  const imageUrl = entity.image_url || getEntityTypeFallbackImage(typeAsString);
  
  // For database insertion, prepare the entity data with only the fields that exist in the database
  const entityForDb = {
    name: entity.name,
    type: typeAsString as "movie" | "book" | "food" | "product" | "place", // Cast to allowed type literals
    venue: entity.venue || null,
    description: entity.description || null,
    image_url: imageUrl,
    api_source: entity.api_source || null,
    api_ref: entity.api_ref || null,
    metadata: entity.metadata || null,
    website_url: entity.website_url || null
  };
  
  const { data, error } = await supabase
    .from('entities')
    .insert(entityForDb)
    .select()
    .single();

  if (error) {
    console.error('Error creating entity:', error);
    return null;
  }

  return data as Entity;
};

// Find or create an entity based on external API data
export const findOrCreateEntity = async (
  name: string,
  type: EntityType | EntityTypeString,
  apiSource: string | null,
  apiRef: string | null,
  venue: string | null = null,
  description: string | null = null,
  imageUrl: string | null = null,
  metadata: any | null = null,
  userId: string | null = null,
  websiteUrl: string | null = null
): Promise<Entity | null> => {
  // If we have API reference information, try to find the entity first
  if (apiSource && apiRef) {
    const existingEntity = await findEntityByApiRef(apiSource, apiRef);
    if (existingEntity) {
      // If it's a Google Places entity and we want to ensure image is up to date
      if (apiSource === 'google_places' && metadata?.photo_reference) {
        // Store photo reference in metadata if it's not there already
        if (!existingEntity.metadata?.photo_reference) {
          const { error: updateError } = await supabase
            .from('entities')
            .update({ 
              metadata: { ...existingEntity.metadata, photo_reference: metadata.photo_reference }
            })
            .eq('id', existingEntity.id);
            
          if (updateError) {
            console.error('Error updating entity metadata with photo reference:', updateError);
          }
        }
      }
      return existingEntity;
    }
  }
  
  // Convert type to string if it's an enum
  const typeAsString = typeof type === 'string' ? type as EntityTypeString : mapEntityTypeToString(type as EntityType);

  // Ensure we have a valid image URL or use fallback based on type
  let finalImageUrl = imageUrl || getEntityTypeFallbackImage(typeAsString);

  // Create a new entity if not found or if we don't have API reference info
  const newEntity = await createEntity({
    name,
    type: typeAsString as any, // Cast to any to bypass type checking
    venue,
    description,
    image_url: finalImageUrl,
    api_source: apiSource,
    api_ref: apiRef,
    metadata,
    website_url: websiteUrl
  });
  
  // If entity was created successfully and the image URL is from an external API
  // that might expire, download and store it for longevity
  if (newEntity && shouldDownloadImage(finalImageUrl, apiSource)) {
    console.log(`Downloading and storing image for new entity: ${newEntity.id}`);
    
    const storedImageUrl = await downloadAndStoreEntityImage(
      finalImageUrl,
      newEntity.id,
      apiSource
    );
    
    // If we successfully downloaded and stored the image, update the entity
    if (storedImageUrl) {
      const { error: updateError } = await supabase
        .from('entities')
        .update({ image_url: storedImageUrl })
        .eq('id', newEntity.id);
        
      if (updateError) {
        console.error('Error updating entity with stored image URL:', updateError);
      } else {
        // Update the local entity object with new image URL
        newEntity.image_url = storedImageUrl;
      }
    }
  }

  return newEntity;
};

// Get entities by type (for searching/filtering)
export const getEntitiesByType = async (type: EntityType | EntityTypeString, searchTerm: string = ''): Promise<Entity[]> => {
  // Convert type to string if it's an enum
  const typeAsString = typeof type === 'string' 
    ? type as string 
    : mapEntityTypeToString(type as EntityType);
  
  let query = supabase
    .from('entities')
    .select('*')
    .eq('type', typeAsString as "movie" | "book" | "food" | "product" | "place")
    .eq('is_deleted', false);
    
  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }
  
  const { data, error } = await query.order('name');

  if (error) {
    console.error('Error fetching entities by type:', error);
    return [];
  }

  return data as Entity[];
};
