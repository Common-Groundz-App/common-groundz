
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from '@/services/recommendation/types';
import { mapStringToEntityType } from '@/hooks/feed/api/types';

export interface EntityWithChildren extends Omit<Entity, 'metadata'> {
  children?: Entity[];
  metadata?: Record<string, any> | null;
}

// Type mapping from database enum to EntityType - uses canonical helper
const mapDatabaseTypeToEntityType = (dbType: string): EntityType => {
  // Use canonical helper to normalize database strings (handles legacy + new canonical types)
  return mapStringToEntityType(dbType as any); // Database may return any string, canonical helper handles it
};

// Convert database entity to application Entity type
const convertDatabaseEntityToEntity = (dbEntity: any): Entity => {
  return {
    id: dbEntity.id,
    name: dbEntity.name,
    description: dbEntity.description,
    image_url: dbEntity.image_url,
    api_ref: dbEntity.api_ref,
    api_source: dbEntity.api_source,
    metadata: dbEntity.metadata ? (typeof dbEntity.metadata === 'string' ? JSON.parse(dbEntity.metadata) : dbEntity.metadata) : {},
    venue: dbEntity.venue,
    website_url: dbEntity.website_url,
    type: mapDatabaseTypeToEntityType(dbEntity.type),
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
    external_ratings: dbEntity.external_ratings,
    price_info: dbEntity.price_info,
    specifications: dbEntity.specifications,
    cast_crew: dbEntity.cast_crew,
    ingredients: dbEntity.ingredients,
    nutritional_info: dbEntity.nutritional_info,
    last_enriched_at: dbEntity.last_enriched_at,
    enrichment_source: dbEntity.enrichment_source,
    data_quality_score: dbEntity.data_quality_score
  };
};

export const getChildEntities = async (parentId: string): Promise<Entity[]> => {
  const { data, error } = await supabase.rpc('get_child_entities', {
    parent_uuid: parentId
  });

  if (error) {
    console.error('Error fetching child entities:', error);
    throw error;
  }

  // Convert the simplified child data to full Entity objects, preserving the slug
  return (data || []).map((child: any) => ({
    id: child.id,
    name: child.name,
    type: mapDatabaseTypeToEntityType(child.type),
    image_url: child.image_url,
    description: child.description,
    api_ref: null,
    api_source: null,
    metadata: {},
    venue: null,
    website_url: null,
    slug: child.slug, // Preserve the actual slug from the database
    category_id: null,
    popularity_score: null,
    photo_reference: null,
    created_at: null,
    updated_at: null,
    authors: null,
    publication_year: null,
    isbn: null,
    languages: null,
    external_ratings: null,
    price_info: null,
    specifications: null,
    cast_crew: null,
    ingredients: null,
    nutritional_info: null,
    last_enriched_at: null,
    enrichment_source: null,
    data_quality_score: null
  }));
};

/**
 * Fetch child entities with their review ratings and counts
 */
export const getChildEntitiesWithRatings = async (parentId: string): Promise<Entity[]> => {
  const { data, error } = await supabase.rpc('get_child_entities_with_ratings', {
    parent_uuid: parentId
  });

  if (error) {
    console.error('Error fetching child entities with ratings:', error);
    throw error;
  }

  // Convert database entities to Entity type with ratings
  return (data || []).map((child: any) => ({
    id: child.id,
    name: child.name,
    type: mapDatabaseTypeToEntityType(child.type),
    image_url: child.image_url,
    description: child.description,
    slug: child.slug,
    venue: child.venue,
    specifications: child.specifications,
    price_info: child.price_info,
    average_rating: child.average_rating ? Number(child.average_rating) : undefined,
    review_count: child.review_count ? Number(child.review_count) : undefined,
    latest_review_date: child.latest_review_date || undefined,
    api_ref: null,
    api_source: null,
    metadata: {},
    website_url: null,
    category_id: null,
    popularity_score: null,
    photo_reference: null,
    created_at: null,
    updated_at: null,
    authors: null,
    publication_year: null,
    isbn: null,
    languages: null,
    external_ratings: null,
    cast_crew: null,
    ingredients: null,
    nutritional_info: null,
    last_enriched_at: null,
    enrichment_source: null,
    data_quality_score: null
  }));
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

  // Get its children with ratings
  try {
    const children = await getChildEntitiesWithRatings(entityId);
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

export const setEntityParent = async (childId: string, parentId: string | null): Promise<void> => {
  // If setting a parent, regenerate the child's slug to be hierarchical
  if (parentId) {
    // Fetch parent entity to get its slug
    const { data: parent, error: parentError } = await supabase
      .from('entities')
      .select('slug, name')
      .eq('id', parentId)
      .single();

    if (parentError) {
      console.error('Error fetching parent entity for slug generation:', parentError);
      throw parentError;
    }

    // Fetch child entity to get its current name
    const { data: child, error: childError } = await supabase
      .from('entities')
      .select('name, slug')
      .eq('id', childId)
      .single();

    if (childError) {
      console.error('Error fetching child entity:', childError);
      throw childError;
    }

    // Generate hierarchical slug
    const parentSlug = parent.slug || parent.name?.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim();
    const baseChildSlug = child.name?.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim();
    const newHierarchicalSlug = `${parentSlug}-${baseChildSlug}`;

    // Update entity with parent_id and new hierarchical slug
    const { error } = await supabase
      .from('entities')
      .update({ 
        parent_id: parentId,
        slug: newHierarchicalSlug
      })
      .eq('id', childId);

    if (error) {
      console.error('Error setting entity parent and updating slug:', error);
      throw error;
    }
    
    console.log(`✅ Updated entity ${childId} with parent ${parentId} and hierarchical slug: ${newHierarchicalSlug}`);
  } else {
    // Removing parent, regenerate slug to be non-hierarchical
    const { data: child, error: childError } = await supabase
      .from('entities')
      .select('name')
      .eq('id', childId)
      .single();

    if (childError) {
      console.error('Error fetching child entity:', childError);
      throw childError;
    }

    const newSlug = child.name?.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim();

    const { error } = await supabase
      .from('entities')
      .update({ 
        parent_id: parentId,
        slug: newSlug
      })
      .eq('id', childId);

    if (error) {
      console.error('Error removing entity parent:', error);
      throw error;
    }
    
    console.log(`✅ Updated entity ${childId} removed parent and updated slug to: ${newSlug}`);
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
