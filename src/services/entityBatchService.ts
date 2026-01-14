import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';

/**
 * Batch fetch entities by IDs in a single query.
 * Returns a Map for O(1) lookup by entity ID.
 */
export const fetchEntitiesByIds = async (
  entityIds: string[]
): Promise<Map<string, Entity>> => {
  if (!entityIds.length) return new Map();

  // Deduplicate IDs
  const uniqueIds = [...new Set(entityIds)];

  try {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .in('id', uniqueIds)
      .eq('is_deleted', false);

    if (error) {
      console.error('Error batch fetching entities:', error);
      return new Map();
    }

    // Return as Map for O(1) lookup
    return new Map((data || []).map(entity => [entity.id, entity as Entity]));
  } catch (err) {
    console.error('Exception in fetchEntitiesByIds:', err);
    return new Map();
  }
};
