
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from './types';
import { EntityTypeString, mapStringToEntityType, mapEntityTypeToString } from '@/hooks/feed/api/types';
import { getEntityTypeFallbackImage } from '@/utils/urlUtils';
import { saveExternalImageToStorage, isValidImageUrl, isGooglePlacesImage } from '@/utils/imageUtils';
import { ensureBucketPolicies } from '@/services/storageService';

// Helper function to extract photo reference from Google Maps image URL
const extractPhotoReferenceFromUrl = (url: string): string | null => {
  try {
    if (!url || !url.includes('maps.googleapis.com/maps/api/place/photo')) {
      return null;
    }

    console.log(`[extractPhotoReferenceFromUrl] Attempting to extract photo reference from URL: ${url}`);
    
    // Extract using URLSearchParams
    const urlObj = new URL(url);
    const photoReference = urlObj.searchParams.get('photoreference');
    
    if (photoReference) {
      console.log(`[extractPhotoReferenceFromUrl] Successfully extracted photo reference: ${photoReference}`);
      return photoReference;
    }
    
    // Fallback to regex if URLSearchParams fails
    const regex = /photoreference=([^&]+)/;
    const match = url.match(regex);
    
    if (match && match[1]) {
      console.log(`[extractPhotoReferenceFromUrl] Extracted photo reference via regex: ${match[1]}`);
      return match[1];
    }
    
    console.warn('[extractPhotoReferenceFromUrl] Failed to extract photo reference from URL');
    return null;
  } catch (error) {
    console.error('[extractPhotoReferenceFromUrl] Error extracting photo reference:', error);
    return null;
  }
};

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

// Refresh entity image using the original API source
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
      console.log('Refreshing Google Places image for entity:', entityId);
      
      // We need to call our Edge Function to get the fresh photo URL
      const { data, error } = await supabase.functions.invoke('refresh-entity-image', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: {
          placeId: entity.api_ref,
          photoReference: entity.metadata.photo_reference,
          entityId: entity.id
        }
      });

      if (error) {
        console.error('Error refreshing entity image:', error);
        return false;
      }
      
      if (!data?.imageUrl) {
        console.error('No image URL returned from refresh-entity-image function');
        return false;
      }

      console.log('Successfully refreshed image for entity:', entityId, 'New URL:', data.imageUrl);

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

/**
 * Process and store an entity's image to Supabase storage
 * This is used both during entity creation and manual refresh
 */
export const processEntityImage = async (entityId: string, imageUrl: string, photoReference?: string, placeId?: string): Promise<string | null> => {
  try {
    console.log(`[processEntityImage] Starting with params:`, { 
      entityId, 
      imageUrl: imageUrl || 'null', 
      photoReference: photoReference || 'null', 
      placeId: placeId || 'null' 
    });
    
    // Ensure the entity-images bucket exists with proper policies
    await ensureBucketPolicies('entity-images');

    // Check if the entity exists and get its current metadata
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', entityId)
      .single();

    if (entityError) {
      console.error('[processEntityImage] Error fetching entity metadata:', entityError);
      // Continue without the metadata since we still want to try processing the image
    } else {
      console.log('[processEntityImage] Entity data:', {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        hasMetadata: entity.metadata ? true : false,
        metadata: entity.metadata,
        api_source: entity.api_source,
        api_ref: entity.api_ref
      });
    }
    
    // For Google Places images, use the refresh-entity-image function directly
    if (isGooglePlacesImage(imageUrl) || (photoReference && placeId)) {
      try {
        // If no photo reference is provided but the URL is a Google Maps URL, try to extract it
        if (!photoReference && isGooglePlacesImage(imageUrl)) {
          const extractedPhotoRef = extractPhotoReferenceFromUrl(imageUrl);
          
          if (extractedPhotoRef) {
            console.log(`[processEntityImage] Extracted photo reference from URL: ${extractedPhotoRef}`);
            photoReference = extractedPhotoRef;
            
            // Update the entity metadata with the extracted photo reference
            if (entityId) {
              // Get the current metadata first - ensure it's an object
              const currentMetadata = typeof entity?.metadata === 'object' ? entity.metadata || {} : {};
              
              // Update the metadata with the extracted photo reference
              const updatedMetadata = { 
                ...currentMetadata,
                photo_reference: extractedPhotoRef 
              };
              
              const { error: updateError } = await supabase
                .from('entities')
                .update({ 
                  metadata: updatedMetadata
                })
                .eq('id', entityId);
                
              if (updateError) {
                console.error('[processEntityImage] Error updating entity metadata with extracted photo reference:', updateError);
              } else {
                console.log(`[processEntityImage] Updated entity metadata with extracted photo reference: ${extractedPhotoRef}`);
              }
            }
          } else {
            console.warn('[processEntityImage] Failed to extract photo reference from Google Maps URL');
          }
        }
        
        if (!photoReference) {
          console.warn('[processEntityImage] No photo reference available, edge function might fail');
        }
        
        if (!placeId && photoReference) {
          console.warn('[processEntityImage] Photo reference available but no Place ID, image quality might be limited');
        }
        
        console.log(`[processEntityImage] Calling refresh-entity-image with params:`, {
          photoReference: photoReference || 'null',
          placeId: placeId || 'null',
          entityId
        });
        
        // Call the refresh-entity-image edge function directly
        const { data, error } = await supabase.functions.invoke('refresh-entity-image', {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: {
            photoReference,
            placeId,
            entityId
          }
        });
        
        if (error) {
          console.error('[processEntityImage] Error invoking refresh-entity-image function:', error);
          return imageUrl; // Return original URL as fallback
        }
        
        if (!data?.imageUrl) {
          console.error('[processEntityImage] No image URL returned from refresh-entity-image function');
          return imageUrl; // Return original URL as fallback
        }
        
        console.log('[processEntityImage] Successfully processed Google Places image:', data.imageUrl);
        return data.imageUrl;
      } catch (googlePlacesError) {
        console.error('[processEntityImage] Error processing Google Places image:', googlePlacesError);
        return imageUrl; // Return original URL as fallback
      }
    } 
    // For non-Google Places images with a valid URL, save to storage
    else if (imageUrl && isValidImageUrl(imageUrl)) {
      try {
        // Download and store the external image
        const storedImageUrl = await saveExternalImageToStorage(imageUrl, entityId);
        
        if (storedImageUrl) {
          console.log(`[processEntityImage] Successfully saved image to storage: ${storedImageUrl}`);
          return storedImageUrl;
        } else {
          console.warn(`[processEntityImage] Failed to save image to storage for entity ${entityId}, using original URL`);
          return imageUrl;
        }
      } catch (imageError) {
        console.error('[processEntityImage] Error saving image to storage:', imageError);
        return imageUrl; // Return original URL as fallback
      }
    }
    
    return imageUrl;
  } catch (error) {
    console.error('[processEntityImage] Error in processEntityImage:', error);
    return imageUrl; // Return original URL as fallback
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
  const finalImageUrl = imageUrl || getEntityTypeFallbackImage(typeAsString);

  // Check if it's a Google Places image and extract photo reference if needed
  if (apiSource === 'google_places' && isGooglePlacesImage(finalImageUrl) && !metadata?.photo_reference) {
    const extractedPhotoRef = extractPhotoReferenceFromUrl(finalImageUrl);
    if (extractedPhotoRef) {
      console.log(`[findOrCreateEntity] Extracted photo reference from URL: ${extractedPhotoRef}`);
      metadata = metadata || {};
      metadata.photo_reference = extractedPhotoRef;
    }
  }

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
  
  if (!newEntity) {
    return null;
  }
  
  // For Google Places entities, immediately process the image after entity creation
  if (apiSource === 'google_places' && finalImageUrl) {
    console.log(`[findOrCreateEntity] Starting image processing for Google Places entity: ${newEntity.id}`);
    console.log(`[findOrCreateEntity] Entity data:`, {
      id: newEntity.id,
      image_url: finalImageUrl,
      api_source: apiSource,
      api_ref: apiRef,
      photo_reference: metadata?.photo_reference || 'missing',
      has_metadata: metadata ? true : false,
      metadata_keys: metadata ? Object.keys(metadata) : []
    });
    
    try {
      // First update metadata to ensure photo_reference is stored
      if (metadata?.photo_reference) {
        const { error: updateError } = await supabase
          .from('entities')
          .update({
            metadata: {
              ...(typeof metadata === 'object' ? metadata : {}),
              photo_reference: metadata.photo_reference
            }
          })
          .eq('id', newEntity.id);
          
        if (updateError) {
          console.error('[findOrCreateEntity] Error updating entity metadata with photo reference:', updateError);
        } else {
          console.log(`[findOrCreateEntity] Updated entity metadata with photo reference: ${metadata.photo_reference}`);
        }
      } else if (isGooglePlacesImage(finalImageUrl)) {
        // Try to extract photo reference from image URL if not provided
        const extractedPhotoRef = extractPhotoReferenceFromUrl(finalImageUrl);
        if (extractedPhotoRef) {
          console.log(`[findOrCreateEntity] Extracted photo reference from URL: ${extractedPhotoRef}`);
          
          const { error: updateError } = await supabase
            .from('entities')
            .update({
              metadata: {
                ...(typeof metadata === 'object' ? metadata || {} : {}),
                photo_reference: extractedPhotoRef
              }
            })
            .eq('id', newEntity.id);
            
          if (updateError) {
            console.error('[findOrCreateEntity] Error updating entity with extracted photo reference:', updateError);
          } else {
            console.log(`[findOrCreateEntity] Updated entity with extracted photo reference: ${extractedPhotoRef}`);
            // Update the local metadata object to be used in the next step
            metadata = metadata || {};
            metadata.photo_reference = extractedPhotoRef;
          }
        }
      }
      
      // Now process the image with the photo reference (original or extracted)
      console.log(`[findOrCreateEntity] Calling processEntityImage with:`, {
        entityId: newEntity.id,
        imageUrl: finalImageUrl,
        photoReference: metadata?.photo_reference || null,
        placeId: apiRef
      });
      
      // Process the image using our helper function
      const processedImageUrl = await processEntityImage(
        newEntity.id, 
        finalImageUrl,
        metadata?.photo_reference,
        apiRef
      );
      
      if (processedImageUrl && processedImageUrl !== finalImageUrl) {
        // Update the entity with the processed image URL - FIXED: Adding retry mechanism
        console.log(`[findOrCreateEntity] Image processed successfully, updating entity with new URL: ${processedImageUrl}`);
        
        let updateSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!updateSuccess && attempts < maxAttempts) {
          attempts++;
          console.log(`[findOrCreateEntity] Updating entity with new image URL (attempt ${attempts})...`);
          
          const { error: updateError } = await supabase
            .from('entities')
            .update({ 
              image_url: processedImageUrl 
            })
            .eq('id', newEntity.id);
            
          if (updateError) {
            console.error(`[findOrCreateEntity] Error updating entity with processed image URL (attempt ${attempts}):`, updateError);
            console.error(`[findOrCreateEntity] Error details:`, JSON.stringify(updateError));
            
            // Wait a bit before retrying with exponential backoff
            if (attempts < maxAttempts) {
              const backoffTime = 500 * Math.pow(2, attempts);
              console.log(`[findOrCreateEntity] Waiting ${backoffTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
          } else {
            updateSuccess = true;
            console.log(`[findOrCreateEntity] Successfully updated entity with processed image URL on attempt ${attempts}`);
            
            // Return updated entity
            return {
              ...newEntity,
              image_url: processedImageUrl
            };
          }
        }
        
        if (!updateSuccess) {
          console.error('[findOrCreateEntity] Failed to update entity with processed image URL after multiple attempts');
        }
      } else {
        console.warn('[findOrCreateEntity] Image processing did not change the URL or failed');
      }
    } catch (googlePlacesError) {
      console.error('[findOrCreateEntity] Error automatically processing Google Places entity image:', googlePlacesError);
    }
  }
  // For non-Google Places entities with external image URLs
  else if (imageUrl && isValidImageUrl(imageUrl)) {
    console.log(`[findOrCreateEntity] Processing external image URL for new entity: ${newEntity.id}`);
    
    try {
      // Process the image using our helper function
      const processedImageUrl = await processEntityImage(newEntity.id, imageUrl);
      
      if (processedImageUrl && processedImageUrl !== imageUrl) {
        // Update the entity with the processed image URL - FIXED: Adding retry mechanism
        let updateSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!updateSuccess && attempts < maxAttempts) {
          attempts++;
          console.log(`[findOrCreateEntity] Updating entity with new image URL (attempt ${attempts})...`);
          
          const { error: updateError } = await supabase
            .from('entities')
            .update({ 
              image_url: processedImageUrl 
            })
            .eq('id', newEntity.id);
            
          if (updateError) {
            console.error(`[findOrCreateEntity] Error updating entity with processed image URL (attempt ${attempts}):`, updateError);
            console.error(`[findOrCreateEntity] Error details:`, JSON.stringify(updateError));
            
            // Wait a bit before retrying with exponential backoff
            if (attempts < maxAttempts) {
              const backoffTime = 500 * Math.pow(2, attempts);
              console.log(`[findOrCreateEntity] Waiting ${backoffTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
          } else {
            updateSuccess = true;
            console.log(`[findOrCreateEntity] Successfully updated entity with processed image URL on attempt ${attempts}`);
            
            // Return updated entity
            return {
              ...newEntity,
              image_url: processedImageUrl
            };
          }
        }
        
        if (!updateSuccess) {
          console.error('[findOrCreateEntity] Failed to update entity with processed image URL after multiple attempts');
        }
      }
    } catch (imageError) {
      console.error('[findOrCreateEntity] Error automatically processing entity image:', imageError);
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
