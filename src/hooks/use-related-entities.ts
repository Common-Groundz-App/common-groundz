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
  const [relatedEntities, setRelatedEntities] = useState<(Entity & { avgRating?: number; reviewCount?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRelatedEntities = async () => {
    if (!entityId || !entityType) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let entities: (Entity & { avgRating?: number; reviewCount?: number })[] = [];
      
      // Primary: Get same-type highly rated entities (exclude current entity)
      const { data: sameTypeEntities, error: sameTypeError } = await supabase
        .from('entities')
        .select(`
          *,
          reviews!inner(rating, latest_rating)
        `)
        .eq('type', entityType)
        .neq('id', entityId)
        .eq('is_deleted', false)
        .limit(limit * 2); // Get more to have better sorting options
        
      if (sameTypeError) throw sameTypeError;
      
      // Process and sort by average rating
      const entitiesWithRatings = (sameTypeEntities as any[])?.map(entity => {
        const ratings = entity.reviews?.map((r: any) => r.latest_rating || r.rating) || [];
        const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
        const { reviews, parent, ...entityWithoutReviews } = entity;
        return {
          ...entityWithoutReviews,
          parent_id: entity.parent_id,
          parent_slug: parent?.slug,
          avgRating,
          reviewCount: ratings.length
        } as Entity & { avgRating: number; reviewCount: number; parent_slug?: string };
      }).sort((a, b) => {
        // First sort by having reviews vs not having reviews
        if (a.reviewCount > 0 && b.reviewCount === 0) return -1;
        if (a.reviewCount === 0 && b.reviewCount > 0) return 1;
        // Then sort by rating if both have reviews
        if (a.avgRating !== b.avgRating) return b.avgRating - a.avgRating;
        // Finally sort by review count
        return b.reviewCount - a.reviewCount;
      }) || [];
      
      entities = entitiesWithRatings.slice(0, limit);
      
      // If we still don't have enough entities and there's a parent, try siblings as fallback
      if (entities.length < limit && parentId) {
        const remainingSlots = limit - entities.length;
        const excludeIds = entities.map(e => e.id);
        
        const { data: siblings, error: siblingsError } = await supabase
          .from('entities')
          .select(`
            *,
            reviews!inner(rating, latest_rating)
          `)
          .eq('parent_id', parentId)
          .neq('id', entityId)
          .eq('is_deleted', false)
          .not('id', 'in', excludeIds.length > 0 ? `(${excludeIds.join(',')})` : '()')
          .limit(remainingSlots);
          
        if (!siblingsError && siblings) {
          // Process siblings with ratings
          const siblingsWithRatings = siblings.map(entity => {
            const ratings = (entity as any).reviews?.map((r: any) => r.latest_rating || r.rating) || [];
            const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
            const { reviews, parent, ...entityWithoutReviews } = entity as any;
            return {
              ...entityWithoutReviews,
              parent_id: entity.parent_id,
              parent_slug: parent?.slug,
              avgRating,
              reviewCount: ratings.length
            } as Entity & { avgRating: number; reviewCount: number; parent_slug?: string };
          });
          
          entities = [...entities, ...siblingsWithRatings];
        }
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