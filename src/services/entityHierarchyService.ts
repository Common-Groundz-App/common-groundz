
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { mapDatabaseEntityType } from './entityTypeMapping';

export interface EntityWithChildren extends Omit<Entity, 'metadata'> {
  children?: Entity[];
  metadata?: Record<string, any> | null;
}

// Convert database entity to application Entity type with safe type mapping
const convertDatabaseEntityToEntity = (dbEntity: any): Entity => {
  // Safe JSON parsing for metadata fields
  const parseJsonField = (field: any): Record<string, any> => {
    if (!field) return {};
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return {};
      }
    }
    return field || {};
  };

  return {
    id: dbEntity.id,
    name: dbEntity.name,
    description: dbEntity.description,
    image_url: dbEntity.image_url,
    api_ref: dbEntity.api_ref,
    api_source: dbEntity.api_source,
    metadata: parseJsonField(dbEntity.metadata),
    venue: dbEntity.venue,
    website_url: dbEntity.website_url,
    type: mapDatabaseEntityType(dbEntity.type), // Use safe type mapping
    slug: dbEntity.slug,
    category_id: dbEntity.category_id,
    popularity_score: dbEntity.popularity_score,
    photo_reference: dbEntity.photo_reference,
    created_at: dbEntity.created_at,
    updated_at: dbEntity.updated_at,
    authors: dbEntity.authors,
    publication_year: dbEntity.publication_year,
    isbn: dbEntity.isbn,
    languages: dbEntity.languages,
    external_ratings: parseJsonField(dbEntity.external_ratings),
    price_info: parseJsonField(dbEntity.price_info),
    specifications: parseJsonField(dbEntity.specifications),
    cast_crew: parseJsonField(dbEntity.cast_crew),
    ingredients: dbEntity.ingredients,
    nutritional_info: parseJsonField(dbEntity.nutritional_info),
    last_enriched_at: dbEntity.last_enriched_at,
    enrichment_source: dbEntity.enrichment_source,
    data_quality_score: dbEntity.data_quality_score
  };
};

export const getChildEntities = async (parentId: string): Promise<Entity[]> => {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('parent_id', parentId)
    .eq('is_deleted', false)
    .order('name');

  if (error) {
    console.error('Error fetching child entities:', error);
    throw error;
  }

  return (data || []).map(convertDatabaseEntityToEntity);
};

export const getEntityWithChildren = async (entityId: string): Promise<EntityWithChildren | null> => {
  // Get the parent entity
  const { data: entity, error: entityError } = await supabase
    .from('entities')
    .select('*')
    .eq('id', entityId)
    .eq('is_deleted', false)
    .single();

  if (entityError) {
    console.error('Error fetching entity:', entityError);
    return null;
  }

  // Get its children
  try {
    const children = await getChildEntities(entityId);
    const convertedEntity = convertDatabaseEntityToEntity(entity);
    
    return {
      ...convertedEntity,
      children,
      metadata: convertedEntity.metadata
    };
  } catch (error) {
    console.error('Error fetching children for entity:', error);
    // Return entity without children if child fetch fails
    const convertedEntity = convertDatabaseEntityToEntity(entity);
    return {
      ...convertedEntity,
      metadata: convertedEntity.metadata
    };
  }
};

export const getParentEntity = async (childId: string): Promise<Entity | null> => {
  const { data: child, error: childError } = await supabase
    .from('entities')
    .select('parent_id')
    .eq('id', childId)
    .single();

  if (childError || !child?.parent_id) {
    return null;
  }

  const { data: parent, error: parentError } = await supabase
    .from('entities')
    .select('*')
    .eq('id', child.parent_id)
    .eq('is_deleted', false)
    .single();

  if (parentError) {
    console.error('Error fetching parent entity:', parentError);
    return null;
  }

  return convertDatabaseEntityToEntity(parent);
};

export const canDeleteEntity = async (entityId: string): Promise<{ canDelete: boolean; reason?: string }> => {
  const children = await getChildEntities(entityId);
  
  if (children.length > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete entity because it has ${children.length} child entities. Please remove children first.`
    };
  }

  return { canDelete: true };
};
