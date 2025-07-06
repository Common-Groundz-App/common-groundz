
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';

export interface EntityWithChildren extends Entity {
  children?: Entity[];
}

export const getChildEntities = async (parentId: string): Promise<Entity[]> => {
  const { data, error } = await supabase.rpc('get_child_entities', {
    parent_uuid: parentId
  });

  if (error) {
    console.error('Error fetching child entities:', error);
    throw error;
  }

  return data || [];
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
    return {
      ...entity,
      children
    };
  } catch (error) {
    console.error('Error fetching children for entity:', error);
    // Return entity without children if child fetch fails
    return entity;
  }
};

export const setEntityParent = async (childId: string, parentId: string | null): Promise<void> => {
  const { error } = await supabase
    .from('entities')
    .update({ parent_id: parentId })
    .eq('id', childId);

  if (error) {
    console.error('Error setting entity parent:', error);
    throw error;
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

  return parent;
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
