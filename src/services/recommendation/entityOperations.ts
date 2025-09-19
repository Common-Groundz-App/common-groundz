
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from './types';
import { EntityTypeString, mapStringToEntityType, mapEntityTypeToString } from '@/hooks/feed/api/types';
import { getEntityTypeFallbackImage, saveExternalImageToStorage } from '@/utils/imageUtils';
import { deferEntityImageRefresh } from '@/utils/imageRefresh';
import { createEnhancedEntity, queueEntityForEnrichment } from '@/services/enhancedEntityService';

// Generate a slug from a name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

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

    // For Google Places entities, use proxy URL with existing photo reference
    if (entity.api_source === 'google_places' && entity.metadata?.photo_reference) {
      // Generate new proxy URL using existing photo reference
      const proxyUrl = `https://uyjtgybbktgapspodajy.supabase.co/functions/v1/proxy-google-image?ref=${entity.metadata.photo_reference}&maxWidth=400`;

      // Update the entity with the proxy URL
      const { error: updateError } = await supabase
        .from('entities')
        .update({ image_url: proxyUrl })
        .eq('id', entityId);

      if (updateError) {
        console.error('Error updating entity image URL:', updateError);
        return false;
      }

      console.log('✅ Google Places entity image refreshed with proxy URL');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in refreshEntityImage:', error);
    return false;
  }
};

// Create a new entity - now using enhanced service with proper image handling
export const createEntity = async (entity: Omit<Entity, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>): Promise<Entity | null> => {
  // Convert EntityType enum to string for database compatibility
  let typeAsString: string;
  
  if (typeof entity.type === 'string') {
    typeAsString = entity.type;
  } else {
    typeAsString = mapEntityTypeToString(entity.type as EntityType);
  }
  
  console.log(`🏗️ Creating entity using enhanced service: ${entity.name}`);
  
  // Use enhanced entity service for rich metadata extraction and proper image handling
  const enhancedEntity = await createEnhancedEntity({
    name: entity.name,
    type: typeAsString,
    venue: entity.venue,
    description: entity.description,
    image_url: entity.image_url,
    api_source: entity.api_source,
    api_ref: entity.api_ref,
    website_url: entity.website_url,
    metadata: entity.metadata || {}
  }, typeAsString);
  
  if (enhancedEntity) {
    console.log(`✅ Enhanced entity created successfully: ${enhancedEntity.name}`);
    return enhancedEntity;
  }
  
  // Fallback to basic entity creation if enhanced service fails
  console.log(`⚠️ Enhanced service failed, falling back to basic entity creation`);
  
  // Ensure we have a valid image URL or use fallback based on type
  const imageUrl = entity.image_url || getEntityTypeFallbackImage(typeAsString);
  
  // Don't generate slug manually - let database trigger handle it based on parent relationship
  
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
    // Don't set slug - let database trigger generate it
  };
  
  console.log(`🏗️ Creating basic entity in database (slug will be auto-generated)`, entityForDb);
  
  const { data, error } = await supabase
    .from('entities')
    .insert(entityForDb)
    .select()
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ Error creating entity:', error);
    return null;
  }

  console.log(`✅ Basic entity created successfully with auto-generated slug: ${data?.slug}`, data);
  
  // Skip local image storage for Google Places entities - they use proxy URLs
  if (data && entity.image_url && !entity.image_url.includes('entity-images') && entity.api_source !== 'google_places') {
    console.log('🖼️ Attempting to save image locally for basic entity:', data.id);
    const savedImageUrl = await saveExternalImageToStorage(entity.image_url, data.id);
    
    if (savedImageUrl && savedImageUrl !== entity.image_url) {
      // Update entity with local image URL
      const { error: updateError } = await supabase
        .from('entities')
        .update({ image_url: savedImageUrl })
        .eq('id', data.id);
      
      if (!updateError) {
        data.image_url = savedImageUrl;
        console.log('✅ Basic entity image updated to local storage');
      }
    }
  } else if (entity.api_source === 'google_places') {
    console.log('✅ Google Places entity using proxy URL - no local storage needed');
  }
  
  return data as Entity;
};

// Find or create an entity based on external API data - now with enhanced processing
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
      console.log(`🔍 Found existing entity: ${existingEntity.id} (${existingEntity.name}) with api_ref: ${apiRef}`);
      
      // Check if entity needs enrichment (older than 7 days or low quality score)
      const needsEnrichment = !existingEntity.last_enriched_at || 
                             new Date(existingEntity.last_enriched_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ||
                             (existingEntity.data_quality_score || 0) < 50;
      
      if (needsEnrichment) {
        console.log(`⏰ Queuing existing entity for enrichment: ${existingEntity.id}`);
        await queueEntityForEnrichment(existingEntity.id, 3); // Higher priority for existing entities
      }
      
      return existingEntity;
    }
  }
  
  // Convert type to string if it's an enum
  const typeAsString = typeof type === 'string' ? type as EntityTypeString : mapEntityTypeToString(type as EntityType);

  console.log(`🆕 Creating new enhanced entity: ${name} (${typeAsString}) with api_ref: ${apiRef}`);
  
  // Create a new entity using enhanced service
  const entity = await createEnhancedEntity({
    name,
    type: typeAsString,
    venue,
    description,
    image_url: imageUrl,
    api_source: apiSource,
    api_ref: apiRef,
    metadata: metadata || {},
    website_url: websiteUrl
  }, typeAsString);
  
  if (!entity) {
    // Fallback to basic entity creation
    console.log(`⚠️ Enhanced entity creation failed, using basic creation`);
    return await createEntity({
      name,
      type: typeAsString as any,
      venue,
      description,
      image_url: imageUrl,
      api_source: apiSource,
      api_ref: apiRef,
      metadata,
      website_url: websiteUrl
      // Don't set slug - let database trigger generate it
    });
  }
  
  // Queue for additional background enrichment if it's from an API source
  if (apiSource && apiRef) {
    console.log(`⏰ Queuing newly created entity for background enrichment: ${entity.id}`);
    await queueEntityForEnrichment(entity.id, 2); // High priority for new entities
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
