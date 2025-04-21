import { useState } from 'react';
import { Entity, EntityType } from '@/services/recommendation/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEntityOperations } from '@/hooks/recommendations/use-entity-operations';

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
  const { handleEntityCreation } = useEntityOperations();
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<Entity[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
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

  const searchExternalAPI = async (searchQuery: string): Promise<ExternalSearchResult[]> => {
    if (!searchQuery.trim()) return [];

    try {
      let functionName = "";

      switch (type) {
        case "place":
          functionName = "search-places";
          break;
        case "movie":
          functionName = "search-movies";
          break;
        case "book":
          functionName = "search-books";
          break;
        case "food":
          functionName = "search-food";
          break;
        case "product":
          functionName = "search-products";
          break;
        default:
          return [];
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

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setLocalResults([]);
      setExternalResults([]);
      return;
    }
    
    setQuery(searchQuery);
    setIsLoading(true);
    
    try {
      const local = await searchLocalEntities(searchQuery);
      setLocalResults(local);
      
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

  const createEntityFromExternal = async (result: ExternalSearchResult): Promise<Entity | null> => {
    try {
      return await handleEntityCreation(
        result.name,
        type,
        result.api_source,
        result.api_ref,
        result.venue,
        result.description,
        result.image_url,
        result.metadata
      );
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

  const createEntityFromUrl = async (url: string): Promise<Entity | null> => {
    try {
      const entity = await handleEntityCreation(
        '', // Name will be populated from metadata
        type,
        'website',
        url,
        null,
        null,
        null,
        null,
        url
      );

      if (entity) {
        toast({
          title: 'Success',
          description: 'Website added successfully'
        });
      }

      return entity;
    } catch (error) {
      console.error('Error creating entity from URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to create entity from URL'
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
    createEntityFromUrl,
    createEntityFromExternal
  };
}
