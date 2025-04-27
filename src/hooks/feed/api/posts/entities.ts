
import { supabase } from '@/integrations/supabase/client';
import { EntitiesByPostId } from './types';

// Fetch post entities for a list of post IDs
export const fetchPostEntities = async (postIds: string[]): Promise<EntitiesByPostId> => {
  if (!postIds.length) return {};
  
  try {
    // Use direct query instead of RPC function that doesn't exist
    const { data: entityData, error: entityError } = await supabase
      .from('post_entities')
      .select('post_id, entity_id, entities:entity_id(*)')
      .in('post_id', postIds);
      
    if (entityError) {
      console.error('Error fetching post entities:', entityError);
      return {};
    }
    
    // Group entities by post_id
    const entitiesByPostId: EntitiesByPostId = {};
    
    if (entityData) {
      entityData.forEach((item: any) => {
        if (!entitiesByPostId[item.post_id]) {
          entitiesByPostId[item.post_id] = [];
        }
        if (item.entities) {
          entitiesByPostId[item.post_id].push(item.entities);
        }
      });
    }
    
    return entitiesByPostId;
  } catch (error) {
    console.error('Error fetching post entities:', error);
    return {};
  }
};
