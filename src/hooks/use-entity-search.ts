
import { useState } from 'react';
import { Entity, EntityType } from '@/services/recommendation/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExternalSearchResult {
  name: string;
  venue: string | null;
  description: string | null;
  image_url: string | null;
  api_source: string;
  api_ref: string;
  metadata: any;
}

export function useEntitySearch(type: EntityType) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<Entity[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Search local entities
  const searchLocalEntities = async (searchQuery: string) => {
    if (!searchQuery.trim()) return [];
    
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('type', type)
        .eq('is_deleted', false)
        .ilike('name', `%${searchQuery}%`)
        .order('name')
        .limit(5);
      
      if (error) throw error;
      return data as Entity[];
    } catch (error) {
      console.error('Error searching local entities:', error);
      return [];
    }
  };

  // Search external API based on entity type
  const searchExternalAPI = async (searchQuery: string): Promise<ExternalSearchResult[]> => {
    if (!searchQuery.trim()) return [];
    
    try {
      let functionName = '';
      
      switch (type) {
        case 'place':
          functionName = 'search-places';
          break;
        case 'movie':
          functionName = 'search-movies';
          break;
        default:
          return []; // No external API for other types yet
      }
      
      if (!functionName) return [];
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { query: searchQuery }
      });
      
      if (error) throw error;
      return data.results || [];
    } catch (error) {
      console.error(`Error searching external API for ${type}:`, error);
      return [];
    }
  };

  // Handle search
  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setLocalResults([]);
      setExternalResults([]);
      return;
    }
    
    setQuery(searchQuery);
    setIsLoading(true);
    
    try {
      // Search local entities
      const local = await searchLocalEntities(searchQuery);
      setLocalResults(local);
      
      // Search external API
      const external = await searchExternalAPI(searchQuery);
      setExternalResults(external);
    } catch (error) {
      console.error('Error during search:', error);
      toast({
        title: 'Search failed',
        description: 'Failed to search for entities. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Create entity from external result
  const createEntityFromExternal = async (result: ExternalSearchResult): Promise<Entity | null> => {
    try {
      const { data, error } = await supabase
        .from('entities')
        .insert({
          name: result.name,
          type: type,
          venue: result.venue,
          description: result.description,
          image_url: result.image_url,
          api_source: result.api_source,
          api_ref: result.api_ref,
          metadata: result.metadata,
          is_deleted: false
        })
        .select('*')
        .single();
      
      if (error) throw error;
      
      return data as Entity;
    } catch (error) {
      console.error('Error creating entity from external result:', error);
      toast({
        title: 'Failed to save',
        description: 'Could not create entity from external result.',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    query,
    localResults,
    externalResults,
    isLoading,
    handleSearch,
    createEntityFromExternal
  };
}
