import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Tag = Database['public']['Tables']['tags']['Row'];

export const searchTags = async (query: string): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .ilike('name_normalized', `%${query.toLowerCase()}%`)
    .order('usage_count', { ascending: false })
    .limit(10);
  
  if (error) throw error;
  return data || [];
};

export const getOrCreateTag = async (tagName: string): Promise<Tag> => {
  const normalized = tagName.toLowerCase().trim();
  
  // Try to find existing
  const { data: existing } = await supabase
    .from('tags')
    .select('*')
    .eq('name_normalized', normalized)
    .maybeSingle();
  
  if (existing) return existing;
  
  // Create new
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: tagName, name_normalized: normalized })
    .select()
    .single();
  
  if (error) throw error;
  return data!;
};

export const addTagToEntity = async (
  entityId: string, 
  tagName: string
): Promise<void> => {
  const tag = await getOrCreateTag(tagName);
  
  await supabase
    .from('entity_tags')
    .insert({ entity_id: entityId, tag_id: tag.id });
};

export const getEntityTags = async (entityId: string): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from('entity_tags')
    .select('tags(*)')
    .eq('entity_id', entityId);
  
  if (error) throw error;
  return data?.map(et => et.tags).filter(Boolean) as Tag[];
};

export const removeTagFromEntity = async (
  entityId: string, 
  tagId: string
): Promise<void> => {
  await supabase
    .from('entity_tags')
    .delete()
    .eq('entity_id', entityId)
    .eq('tag_id', tagId);
};

export const getPopularTags = async (limit: number = 20): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('usage_count', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
};
