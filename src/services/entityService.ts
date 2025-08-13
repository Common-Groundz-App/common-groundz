import { supabase } from '@/integrations/supabase/client';
import { Entity, RecommendationCategory } from '@/services/recommendation/types';
import { attachProfilesToEntities } from '@/services/enhancedUnifiedProfileService';
import { RecommendationWithUser, ReviewWithUser } from '@/types/entities';
import { MediaItem } from '@/types/common';

/**
 * Fetch an entity by its slug or ID
 */
export const fetchEntityBySlug = async (slugOrId: string): Promise<Entity | null> => {
  console.log('🔍 fetchEntityBySlug called with:', slugOrId);
  
  // First try to fetch by slug
  let { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('slug', slugOrId)
    .eq('is_deleted', false)
    .maybeSingle();

  if (error) {
    console.error('Error fetching entity by slug:', error);
  }

  // If not found by slug and the parameter looks like a UUID, try by ID
  if (!data && isValidUUID(slugOrId)) {
    console.log('🔄 Slug lookup failed, trying by ID:', slugOrId);
    const result = await supabase
      .from('entities')
      .select('*')
      .eq('id', slugOrId)
      .eq('is_deleted', false)
      .maybeSingle();
    
    data = result.data;
    error = result.error;
    
    if (error) {
      console.error('Error fetching entity by ID:', error);
    }
  }

  if (data) {
    console.log('✅ Entity found:', data.name, 'with slug:', data.slug);
  } else {
    console.log('❌ Entity not found for:', slugOrId);
  }

  return data as Entity;
};

/**
 * Helper function to check if a string is a valid UUID
 */
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export async function getEntityById(entityId: string): Promise<Entity | null> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', entityId)
    .single();

  if (error) {
    console.error('Error fetching entity:', error);
    return null;
  }

  return data;
}

export async function searchEntities(searchTerm: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .ilike('name', `%${searchTerm}%`)
    .limit(10);

  if (error) {
    console.error('Error searching entities:', error);
    return [];
  }

  return data?.map(entity => ({
    ...entity,
    category: entity.type || 'uncategorized'
  })) || [];
}