import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { Entity, EntityType } from '@/services/recommendation/types';

interface BrandSearchResults {
  brands: Entity[];
  isLoading: boolean;
  error: string | null;
}

export const useBrandSearch = (query: string): BrandSearchResults => {
  const [brands, setBrands] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    const searchBrands = async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 1) {
        setBrands([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: searchError } = await supabase
          .from('entities')
          .select('*')
          .eq('type', EntityType.Brand)
          .eq('is_deleted', false)
          .ilike('name', `%${debouncedQuery.trim()}%`)
          .order('name')
          .limit(10);

        if (searchError) {
          console.error('Error searching brands:', searchError);
          setError('Failed to search brands');
          setBrands([]);
        } else {
          setBrands((data || []) as Entity[]);
        }
      } catch (err) {
        console.error('Error in brand search:', err);
        setError('Failed to search brands');
        setBrands([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchBrands();
  }, [debouncedQuery]);

  return { brands, isLoading, error };
};