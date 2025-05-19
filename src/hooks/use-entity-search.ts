
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './use-toast';
import type { Entity as ServiceEntity } from '@/services/recommendation/types';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';

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
}

// Function to calculate distance between two points
function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  // Haversine formula to calculate distance between two points on Earth
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

export function useEntitySearch(type: EntityTypeString) {
  const [localResults, setLocalResults] = useState<Entity[]>([]);
  const [externalResults, setExternalResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Convert string type to enum type for database operations
  const entityTypeEnum = mapStringToEntityType(type);

  // Check if location is enabled in localStorage
  const isLocationEnabled = (): boolean => {
    return localStorage.getItem('locationEnabled') === 'true';
  };

  const handleSearch = useCallback(async (query: string, useLocation: boolean = false, position?: { latitude: number, longitude: number }) => {
    if (!query || query.length < 2) return;
    
    setIsLoading(true);
    
    try {
      // Search in our local database first - use the string type directly for the query
      const { data: localData, error: localError } = await supabase
        .from('entities')
        .select()
        .eq('type', type) // String type is compatible with database
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(5);
      
      if (localError) throw localError;
      
      // Process local results - add distance if position is available
      let processedLocalData = localData as Entity[] || [];
      
      // Calculate distance for local entities if location is available and enabled
      if (useLocation && isLocationEnabled() && position && processedLocalData.length > 0) {
        processedLocalData = processedLocalData.map(entity => {
          // Check if the entity has location data in its metadata
          const hasLocationData = entity.metadata && 
            entity.metadata.location && 
            typeof entity.metadata.location.lat === 'number' && 
            typeof entity.metadata.location.lng === 'number';
          
          if (hasLocationData) {
            // Calculate distance and add it to the entity metadata
            const distance = calculateDistance(
              position.latitude,
              position.longitude,
              entity.metadata.location.lat,
              entity.metadata.location.lng
            );
            
            return {
              ...entity,
              metadata: {
                ...entity.metadata,
                distance
              }
            };
          }
          
          return entity;
        });
      }
      
      // Set local database results
      setLocalResults(processedLocalData);
      
      // External API search
      let externalData;
      
      // Call appropriate Supabase Edge Function based on entity type
      let functionName;
      let payload: any = { query };
      
      // Add location data if available and requested
      if (useLocation && isLocationEnabled() && position) {
        payload.latitude = position.latitude;
        payload.longitude = position.longitude;
      }
      
      // Always send the locationEnabled flag to the edge function
      payload.locationEnabled = useLocation && isLocationEnabled();
      
      // Pass the category parameter for filtering (important for food category)
      payload.category = type;
      
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
      
      console.log(`Searching for ${type} with query: "${query}"`, payload);
      
      const { data: funcData, error: funcError } = await supabase.functions.invoke(functionName, {
        body: payload
      });
      
      if (funcError) throw funcError;
      
      externalData = funcData?.results || [];
      console.log(`Received ${externalData.length} results from ${functionName}:`, externalData);
      
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
      // Create a new entity record from external data - use string type as is
      const entityData = {
        id: uuidv4(),
        name: externalData.name,
        type, // Use the string type as is for database compatibility
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
        .insert([{ // Use array format to ensure correct typing
          name: entityData.name,
          type: entityData.type,
          venue: entityData.venue,
          description: entityData.description,
          image_url: entityData.image_url,
          api_source: entityData.api_source,
          api_ref: entityData.api_ref,
          metadata: entityData.metadata
        }])
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
      
      // Create entity from the metadata - use string type
      const entityData = {
        name: data.metadata.title || data.metadata.og_title || url.split('/').pop() || 'Untitled',
        venue: data.metadata.site_name || new URL(url).hostname,
        description: data.metadata.description || data.metadata.og_description || null,
        image_url: data.metadata.og_image || data.metadata.image || null,
        api_source: 'url_metadata',
        api_ref: url,
        metadata: data.metadata
      };
      
      // Insert the entity into our database - use array format to ensure correct typing
      const { data: insertData, error: insertError } = await supabase
        .from('entities')
        .insert([{
          name: entityData.name,
          type,
          venue: entityData.venue,
          description: entityData.description,
          image_url: entityData.image_url,
          api_source: entityData.api_source,
          api_ref: entityData.api_ref,
          metadata: entityData.metadata
        }])
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
