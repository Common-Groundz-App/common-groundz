import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BrandInfo {
  name: string;
  image_url?: string;
}

interface UseBrandRehydrationResult {
  brandName: string | null;
  brandImageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useBrandRehydration = (parentEntityId: string | undefined): UseBrandRehydrationResult => {
  const [brandInfo, setBrandInfo] = useState<BrandInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrandInfo = async () => {
      if (!parentEntityId) {
        setBrandInfo(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('entities')
          .select('name, image_url')
          .eq('id', parentEntityId)
          .eq('is_deleted', false)
          .single();

        if (fetchError) {
          console.error('Error fetching brand info:', fetchError);
          setError('Failed to fetch brand information');
          setBrandInfo(null);
        } else {
          setBrandInfo(data);
        }
      } catch (err) {
        console.error('Error in brand rehydration:', err);
        setError('Failed to fetch brand information');
        setBrandInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBrandInfo();
  }, [parentEntityId]);

  return {
    brandName: brandInfo?.name || null,
    brandImageUrl: brandInfo?.image_url || null,
    isLoading,
    error
  };
};