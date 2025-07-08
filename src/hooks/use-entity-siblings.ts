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
        .select('*')
        .eq('parent_id', parentId)
        .neq('id', entityId)
        .eq('is_deleted', false)
        .limit(10);

      if (fetchError) {
        throw fetchError;
      }

      setSiblings((data as Entity[]) || []);
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