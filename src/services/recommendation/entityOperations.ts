
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from './types';

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

// Create a new entity
export const createEntity = async (entity: Omit<Entity, 'id' | 'created_at' | 'updated_at' | 'is_deleted'>): Promise<Entity | null> => {
  const { data, error } = await supabase
    .from('entities')
    .insert({ ...entity, is_deleted: false })
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
  type: EntityType,
  apiSource: string | null,
  apiRef: string | null,
  venue: string | null = null,
  description: string | null = null,
  imageUrl: string | null = null,
  metadata: any | null = null,
  userId: string | null = null
): Promise<Entity | null> => {
  // If we have API reference information, try to find the entity first
  if (apiSource && apiRef) {
    const existingEntity = await findEntityByApiRef(apiSource, apiRef);
    if (existingEntity) {
      return existingEntity;
    }
  }

  // Create a new entity if not found or if we don't have API reference info
  return createEntity({
    name,
    type,
    venue,
    description,
    image_url: imageUrl,
    api_source: apiSource,
    api_ref: apiRef,
    metadata,
    created_by: userId
  });
};

// Get entities by type (for searching/filtering)
export const getEntitiesByType = async (type: EntityType, searchTerm: string = ''): Promise<Entity[]> => {
  let query = supabase
    .from('entities')
    .select('*')
    .eq('type', type)
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
