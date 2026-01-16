import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';

/**
 * Batch fetch entities by IDs in a single query.
 * Also fetches rating stats from entity_stats_view and merges them.
 * Returns a Map for O(1) lookup by entity ID.
 */
export const fetchEntitiesByIds = async (
  entityIds: string[]
): Promise<Map<string, Entity>> => {
  if (!entityIds.length) return new Map();

  // Deduplicate IDs
  const uniqueIds = [...new Set(entityIds)];

  try {
    // Fetch entities and stats in parallel
    const [entitiesResult, statsResult] = await Promise.all([
      supabase
        .from('entities')
        .select('*')
        .in('id', uniqueIds)
        .eq('is_deleted', false),
      supabase
        .from('entity_stats_view')
        .select('entity_id, average_rating, review_count, recommendation_count')
        .in('entity_id', uniqueIds)
    ]);

    if (entitiesResult.error) {
      console.error('Error fetching entities:', entitiesResult.error);
      return new Map();
    }

    if (statsResult.error) {
      console.error('Error fetching entity stats:', statsResult.error);
      // Continue without stats - entities are still useful
    }

    // Create stats map for O(1) lookup
    const statsMap = new Map(
      (statsResult.data || []).map(s => [s.entity_id, s])
    );

    // Merge entities with stats and return as Map
    return new Map(
      (entitiesResult.data || []).map(entity => {
        const entityStats = statsMap.get(entity.id);
        return [
          entity.id,
          {
            ...entity,
            average_rating: entityStats?.average_rating ?? null,
            review_count: entityStats?.review_count ?? 0,
            recommendation_count: entityStats?.recommendation_count ?? 0,
          } as Entity
        ];
      })
    );
  } catch (err) {
    console.error('Exception in fetchEntitiesByIds:', err);
    return new Map();
  }
};
