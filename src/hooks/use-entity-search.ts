
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { EntityType } from '@/services/recommendation/types';

// Define Entity type based on the database schema
export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  venue: string | null;
  description: string | null;
  image_url: string | null;
  api_source: string | null;
  api_ref: string | null;
  metadata: any | null;
  created_by: string | null;
  is_deleted: boolean;
  is_verified: boolean | null;
  verification_date: string | null;
  website_url: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export function useEntitySearch(type: EntityType) {
  const [localResults, setLocalResults] = useState<Entity[]>([]);
  const [externalResults, setExternalResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string, useLocation: boolean = false, position?: { latitude: number, longitude: number }) => {
    if (!query || query.length < 2) return;
    
    setIsLoading(true);
    
    try {
      // Search in our local database first
      const { data: localData, error: localError } = await supabase
        .from('entities')
        .select()
        .eq('type', type)
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(5);
      
      if (localError) throw localError;
      
      // Set local database results
      setLocalResults(localData as Entity[] || []);
      
      // External API search
      let externalData;
      
      // Call appropriate Supabase Edge Function based on entity type
      let functionName;
      let payload: any = { query };
      
      // Add location data if available and requested
      if (useLocation && position) {
        payload.latitude = position.latitude;
        payload.longitude = position.longitude;
      }
      
      switch (type) {
        case 'place':
        case 'food':
          functionName = 'search-places';
          break;
        case 'movie':
          functionName = 'search-movies';
          break;
        case 'book':
          functionName = 'search-books';
          break;
        case 'product':
          functionName = 'search-products';
          break;
        default:
          functionName = 'search-places';
      }
      
      const { data: funcData, error: funcError } = await supabase.functions.invoke(functionName, {
        body: payload
      });
      
      if (funcError) throw funcError;
      
      externalData = funcData?.results || [];
      
      // Set external API results
      setExternalResults(externalData);
      
    } catch (error) {
      console.error(`Error searching for ${type}:`, error);
      toast({
        title: 'Search failed',
        description: `Could not search for ${type}s. Please try again.`,
        variant: 'destructive'
      });
      setExternalResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [type, toast]);

  const createEntityFromExternal = useCallback(async (externalData: any) => {
    try {
      // Create a new entity record from external data
      const entityData = {
        id: uuidv4(),
        name: externalData.name,
        type: type,
        venue: externalData.venue,
        description: externalData.description || null,
        image_url: externalData.image_url || null,
        api_source: externalData.api_source,
        api_ref: externalData.api_ref,
        metadata: externalData.metadata,
        is_deleted: false
      };
      
      // Insert the entity into our database
      const { data, error } = await supabase
        .from('entities')
        .insert(entityData)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data as Entity;
    } catch (error) {
      console.error('Error creating entity:', error);
      toast({
        title: 'Error',
        description: 'Could not save this entity. Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  }, [type, toast]);

  const createEntityFromUrl = useCallback(async (url: string) => {
    try {
      // Call the fetch-url-metadata function to scrape metadata
      const { data, error } = await supabase.functions.invoke('fetch-url-metadata', {
        body: { url }
      });
      
      if (error) throw error;
      
      if (!data?.metadata) {
        throw new Error('Could not fetch metadata from URL');
      }
      
      // Create entity from the metadata
      const entityData = {
        id: uuidv4(),
        name: data.metadata.title || data.metadata.og_title || url.split('/').pop() || 'Untitled',
        type: type,
        venue: data.metadata.site_name || new URL(url).hostname,
        description: data.metadata.description || data.metadata.og_description || null,
        image_url: data.metadata.og_image || data.metadata.image || null,
        api_source: 'url_metadata',
        api_ref: url,
        metadata: data.metadata,
        is_deleted: false
      };
      
      // Insert the entity into our database
      const { data: insertData, error: insertError } = await supabase
        .from('entities')
        .insert(entityData)
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      return insertData as Entity;
    } catch (error) {
      console.error('Error creating entity from URL:', error);
      toast({
        title: 'Error',
        description: 'Could not create entity from this URL. Please check the URL and try again.',
        variant: 'destructive'
      });
      return null;
    }
  }, [type, toast]);

  return {
    localResults,
    externalResults,
    isLoading,
    handleSearch,
    createEntityFromExternal,
    createEntityFromUrl
  };
}
