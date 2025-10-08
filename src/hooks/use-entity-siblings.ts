import { useState, useEffect } from 'react';
import { Entity } from '@/services/recommendation/types';
import { supabase } from '@/integrations/supabase/client';

export const useEntitySiblings = (entityId: string | null, parentId: string | null) => {
  const [siblings, setSiblings] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSiblings = async () => {
    if (!entityId || !parentId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('entities')
        .select(`
          *,
          reviews:reviews(rating)
        `)
        .eq('parent_id', parentId)
        .neq('id', entityId)
        .eq('is_deleted', false)
        .limit(10);

      if (fetchError) {
        throw fetchError;
      }

      // Calculate average ratings from reviews
      const siblingsWithRatings = (data || []).map((entity: any) => {
        const reviews = entity.reviews || [];
        const ratings = reviews.map((r: any) => r.rating).filter((r: number) => r > 0);
        const average_rating = ratings.length > 0 
          ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length 
          : 0;
        
        // Remove reviews array and add calculated average_rating
        const { reviews: _, ...entityData } = entity;
        return {
          ...entityData,
          average_rating
        };
      });

      setSiblings(siblingsWithRatings as Entity[]);
    } catch (err) {
      console.error('Error fetching siblings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch siblings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSiblings();
  }, [entityId, parentId]);

  return {
    siblings,
    isLoading,
    error,
    refresh: fetchSiblings
  };
};