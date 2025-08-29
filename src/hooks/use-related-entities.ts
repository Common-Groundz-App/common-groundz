import { useState, useEffect } from 'react';
import { Entity } from '@/services/recommendation/types';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type EntityTypeString = Database['public']['Enums']['entity_type'];

interface UseRelatedEntitiesProps {
  entityId: string | null;
  entityType: EntityTypeString | null;
  parentId: string | null;
  limit?: number;
}

export const useRelatedEntities = ({ entityId, entityType, parentId, limit = 3 }: UseRelatedEntitiesProps) => {
  const [relatedEntities, setRelatedEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRelatedEntities = async () => {
    if (!entityId || !entityType) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let entities: Entity[] = [];
      
      // First, try to get sibling entities if parent exists
      if (parentId) {
        const { data: siblings, error: siblingsError } = await supabase
          .from('entities')
          .select('*')
          .eq('parent_id', parentId)
          .neq('id', entityId)
          .eq('is_deleted', false)
          .limit(limit);
          
        if (siblingsError) throw siblingsError;
        entities = siblings as Entity[] || [];
      }
      
      // If we don't have enough entities, fill with same-type highly rated ones
      const remainingSlots = limit - entities.length;
      if (remainingSlots > 0) {
        const excludeIds = entities.length > 0 ? entities.map(e => e.id) : [];
        const { data: sameTypeEntities, error: sameTypeError } = await supabase
          .from('entities')
          .select(`
            *,
            reviews!inner(rating)
          `)
          .eq('type', entityType)
          .neq('id', entityId)
          .eq('is_deleted', false)
          .not('id', 'in', excludeIds.length > 0 ? `(${excludeIds.join(',')})` : '()')
          .limit(remainingSlots);
          
        if (sameTypeError) throw sameTypeError;
        
        // Process and sort by average rating
        const entitiesWithRatings = (sameTypeEntities as any[])?.map(entity => {
          const ratings = entity.reviews?.map((r: any) => r.rating) || [];
          const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
          return {
            ...entity,
            avgRating,
            reviewCount: ratings.length
          };
        }).sort((a, b) => {
          if (a.avgRating !== b.avgRating) return b.avgRating - a.avgRating;
          return b.reviewCount - a.reviewCount;
        }) || [];
        
        entities = [...entities, ...entitiesWithRatings.slice(0, remainingSlots)];
      }
      
      setRelatedEntities(entities.slice(0, limit));
    } catch (err) {
      console.error('Error fetching related entities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch related entities');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRelatedEntities();
  }, [entityId, entityType, parentId, limit]);

  return {
    relatedEntities,
    isLoading,
    error,
    refresh: fetchRelatedEntities
  };
};