import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import type { EntityTypeString } from '@/hooks/feed/api/types';

// Define a simplified entity structure for the component's internal use
interface Entity {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  type: EntityTypeString;
  venue?: string;
  api_source?: string;
  api_ref?: string;
  metadata?: any;
  slug?: string;
}

export function useUniversalEntitySearch() {
  const [localResults, setLocalResults] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setLocalResults([]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Search in our local database for entities across all types
      const { data: entityData, error: localError } = await supabase
        .from('entities')
        .select('id, name, description, image_url, type, venue, api_source, api_ref, metadata, slug')
        .eq('is_deleted', false)
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(20);
      
      if (localError) throw localError;
      
      // Set local database results
      setLocalResults(entityData as Entity[] || []);
      
    } catch (error) {
      console.error('Error searching entities:', error);
      toast({
        title: 'Search failed',
        description: 'Could not search for entities. Please try again.',
        variant: 'destructive'
      });
      setLocalResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    localResults,
    isLoading,
    handleSearch
  };
}