import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './use-toast';
import type { Entity as ServiceEntity } from '@/services/recommendation/types';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';
import { getEntityTypeFallbackImage } from '@/utils/urlUtils';
import { findEntityByApiRef, processEntityImage } from '@/services/recommendation/entityOperations';
import { isValidImageUrl, isGooglePlacesImage } from '@/utils/imageUtils';
import { ensureBucketPolicies } from '@/services/storageService';

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
      // Check if an entity with the same api_source and api_ref already exists
      if (externalData.api_source && externalData.api_ref) {
        const existingEntity = await findEntityByApiRef(externalData.api_source, externalData.api_ref);
        
        if (existingEntity) {
          console.log(`Found existing entity: ${existingEntity.id} (${existingEntity.name})`);
          // Return the existing entity instead of trying to create a new one
          return existingEntity;
        }
      }

      // Generate a new entity ID
      const entityId = uuidv4();
      
      // Ensure the entity-images bucket exists with proper policies
      await ensureBucketPolicies('entity-images');
      
      // Set initial image URL from external data or use fallback
      let imageUrl = externalData.image_url || getEntityTypeFallbackImage(type);
      
      console.log(`Creating new entity: ${externalData.name}`, { originalImageUrl: imageUrl });

      // Prepare entity data for insertion - we'll update the image after insertion if needed
      const entityData = {
        id: entityId,
        name: externalData.name,
        type,
        venue: externalData.venue,
        description: externalData.description || null,
        image_url: imageUrl,
        api_source: externalData.api_source,
        api_ref: externalData.api_ref,
        photo_reference: externalData.metadata?.photos?.[0]?.photo_reference,
        metadata: externalData.metadata,
        is_deleted: false
      };
      
      // Insert the entity into the database
      const { data, error } = await supabase
        .from('entities')
        .insert({
          id: entityData.id,
          name: entityData.name,
          type: entityData.type,
          venue: entityData.venue,
          description: entityData.description,
          image_url: entityData.image_url,
          api_source: entityData.api_source,
          api_ref: entityData.api_ref,
          photo_reference: entityData.photo_reference,
          metadata: entityData.metadata
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting entity:', error);
        throw error;
      }

      // Now process the image automatically - no need to wait for the user to click "Refresh Image"
      try {
        console.log(`Automatically processing image for new entity: ${entityData.id}`);
        
        // Google Places images need special handling
        if (externalData.api_source === 'google_places' && externalData.metadata?.photos?.[0]?.photo_reference) {
          // Process Google Places image using our helper function
          const photoReference = externalData.metadata.photos[0].photo_reference;
          const processedImageUrl = await processEntityImage(
            entityData.id,
            imageUrl,
            photoReference,
            externalData.api_ref
          );
          
          if (processedImageUrl && processedImageUrl !== imageUrl) {
            // Update the entity with the processed image URL
            await supabase
              .from('entities')
              .update({ image_url: processedImageUrl })
              .eq('id', entityData.id);
              
            // Return the entity with the updated image URL
            return { 
              ...data, 
              image_url: processedImageUrl 
            } as Entity;
          }
        }
        // For non-Google Places images
        else if (imageUrl && isValidImageUrl(imageUrl) && !isGooglePlacesImage(imageUrl)) {
          // Process external image
          const processedImageUrl = await processEntityImage(entityData.id, imageUrl);
          
          if (processedImageUrl && processedImageUrl !== imageUrl) {
            // Update the entity with the processed image URL
            await supabase
              .from('entities')
              .update({ image_url: processedImageUrl })
              .eq('id', entityData.id);
              
            // Return the entity with the updated image URL
            return { 
              ...data, 
              image_url: processedImageUrl 
            } as Entity;
          }
        }
      } catch (imageProcessingError) {
        console.error('Error processing entity image:', imageProcessingError);
        // Continue with original image URL if processing fails
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

      // Generate a new entity ID
      const entityId = uuidv4();
      
      // Get appropriate image or fallback
      let imageUrl = data.metadata.og_image || data.metadata.image || getEntityTypeFallbackImage(type);
      
      // Create entity from the metadata - use string type
      const entityData = {
        id: entityId,
        name: data.metadata.title || data.metadata.og_title || url.split('/').pop() || 'Untitled',
        type,
        venue: data.metadata.site_name || new URL(url).hostname,
        description: data.metadata.description || data.metadata.og_description || null,
        image_url: imageUrl,
        api_source: 'url_metadata',
        api_ref: url,
        metadata: data.metadata
      };
      
      // Insert the entity into our database
      const { data: insertData, error: insertError } = await supabase
        .from('entities')
        .insert({
          id: entityData.id,
          name: entityData.name,
          type: entityData.type,
          venue: entityData.venue,
          description: entityData.description,
          image_url: entityData.image_url,
          api_source: entityData.api_source,
          api_ref: entityData.api_ref,
          metadata: entityData.metadata
        })
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      // Now process the image automatically
      try {
        console.log(`Automatically processing image for URL-based entity: ${entityData.id}`);
        
        if (imageUrl && isValidImageUrl(imageUrl)) {
          // Process the external image
          const processedImageUrl = await processEntityImage(entityData.id, imageUrl);
          
          if (processedImageUrl && processedImageUrl !== imageUrl) {
            // Update the entity with the processed image URL
            await supabase
              .from('entities')
              .update({ image_url: processedImageUrl })
              .eq('id', entityData.id);
              
            // Return the entity with the updated image URL
            return { 
              ...insertData, 
              image_url: processedImageUrl 
            } as Entity;
          }
        }
      } catch (imageProcessingError) {
        console.error('Error processing entity image from URL:', imageProcessingError);
        // Continue with original image URL if processing fails
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
