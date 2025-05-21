
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from './types';
import { EntityTypeString, mapStringToEntityType, mapEntityTypeToString } from '@/hooks/feed/api/types';
import { getEntityTypeFallbackImage } from '@/utils/imageUtils';
import { deferEntityImageRefresh } from '@/utils/imageRefresh';

// Fetch an entity by its ID
export const fetchEntityById = async (entityId: string): Promise<Entity | null> => {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', entityId)
    .eq('is_deleted', false)
    .limit(1)
    .maybeSingle();

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
    .limit(1)
    .maybeSingle();

  if (error) {
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
    if (entity.api_source === 'google_places' && entity.api_ref && entity.metadata?.photo_reference) {
      // We need to call our Edge Function to get the fresh photo URL
      const { data, error } = await supabase.functions.invoke('refresh-entity-image', {
        body: {
          entityId,
          placeId: entity.api_ref,
          photoReference: entity.metadata.photo_reference
        }
      });

      if (error || !data?.imageUrl) {
        console.error('Error refreshing entity image:', error);
        return false;
      }

      // Update the entity with the new image URL
      const { error: updateError } = await supabase
        .from('entities')
        .update({ image_url: data.imageUrl })
        .eq('id', entityId);

      if (updateError) {
        console.error('Error updating entity image URL:', updateError);
        return false;
      }

      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in refreshEntityImage:', error);
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
    .limit(1)
    .maybeSingle();

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
      console.log(`Found existing entity: ${existingEntity.id} (${existingEntity.name}) with api_ref: ${apiRef}`);
      
      // If it's a Google Places entity and we want to ensure image is up to date
      if (apiSource === 'google_places' && metadata?.photo_reference) {
        // Store photo reference in metadata if it's not there already
        if (!existingEntity.metadata?.photo_reference) {
          console.log(`Updating entity ${existingEntity.id} with photo reference: ${metadata.photo_reference}`);
          
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
  const finalImageUrl = imageUrl || getEntityTypeFallbackImage(typeAsString);

  console.log(`Creating new entity: ${name} (${typeAsString}) with api_ref: ${apiRef}`);
  
  // Create a new entity if not found or if we don't have API reference info
  const entity = await createEntity({
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
  
  // If entity creation was successful and it's a Google Places entity,
  // schedule a background image refresh after a delay
  if (entity && apiSource === 'google_places' && apiRef) {
    console.log(`Scheduling deferred image refresh for newly created entity: ${entity.id}`);
    deferEntityImageRefresh(entity.id);
  }
  
  return entity;
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
