import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './use-toast';
import type { Entity as ServiceEntity } from '@/services/recommendation/types';
import { EntityTypeString, mapStringToEntityType } from '@/hooks/feed/api/types';
import { getEntityTypeFallbackImage } from '@/utils/urlUtils';
import { findEntityByApiRef } from '@/services/recommendation/entityOperations';
import { saveExternalImageToStorage, isValidImageUrl, isGooglePlacesImage } from '@/utils/imageUtils';
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
      let localData: Entity[] = [];

      if (type === 'people') {
        // Search for users in profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .or(`username.ilike.%${query}%, bio.ilike.%${query}%`)
          .limit(10);
        
        if (profileError) throw profileError;

        // Transform user profiles to entity format
        localData = (profileData || []).map(profile => ({
          id: profile.id,
          name: profile.username || 'Unknown User',
          description: profile.bio || undefined,
          image_url: profile.avatar_url || undefined,
          type: 'people' as EntityTypeString,
          metadata: { userProfile: true }
        }));
      } else {
        // Search in our local database for entities
        const { data: entityData, error: localError } = await supabase
          .from('entities')
          .select()
          .eq('type', type as any) // Cast to any to handle extended entity types
          .or(`name.ilike.%${query}%, description.ilike.%${query}%, slug.ilike.%${query}%`)
          .order('name')
          .limit(5);
        
        if (localError) throw localError;
        localData = entityData as Entity[] || [];
      }
      
      // Process local results - add distance if position is available
      let processedLocalData = localData;
      
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
      
      // External API search - skip for people since we only search locally
      if (type === 'people') {
        setExternalResults([]);
      } else {
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
      }
      
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
      // For people type, we don't create external entities - users are only from our profiles table
      if (type === 'people') {
        console.log('Cannot create external entity for people type');
        return null;
      }

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
      let storedImageUrl = null;
      
      console.log(`Processing image for entity: ${externalData.name}`, { originalUrl: imageUrl });
      
      // Handle Google Places images special case - these require the refresh-entity-image function
      if (isGooglePlacesImage(imageUrl)) {
        console.log(`Google Places image detected for ${externalData.name}, will be stored via refresh later`);
        // Keep the original URL for now, but store the photo reference for later refresh
      } 
      // For non-Google Places images with a valid URL, try to save to storage immediately
      else if (imageUrl && isValidImageUrl(imageUrl) && !isGooglePlacesImage(imageUrl)) {
        try {
          // Download and store the external image
          storedImageUrl = await saveExternalImageToStorage(imageUrl, entityId);
          
          if (storedImageUrl) {
            console.log(`Successfully saved image to storage: ${storedImageUrl}`);
            imageUrl = storedImageUrl;
          } else {
            console.warn(`Failed to save image to storage for ${externalData.name}, using original URL`);
          }
        } catch (imageError) {
          console.error('Error saving image to storage:', imageError);
          // Keep the original URL if storage fails
        }
      }
      
      // Prepare entity data for insertion
      const entityData = {
        name: externalData.name,
        type: type as any, // Cast to any to handle extended entity types
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
        .insert(entityData)
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting entity:', error);
        throw error;
      }
      
      // For Google Places entities, if we have a photo reference, refresh the image immediately
      if (isGooglePlacesImage(imageUrl) && entityData.photo_reference) {
        try {
          console.log(`Refreshing Google Places image for new entity ${data.id}`);
          
          // Get current session for authentication
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            // Call the refresh-entity-image edge function to store the image properly
            const response = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/refresh-entity-image`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                photoReference: entityData.photo_reference,
                placeId: entityData.api_ref,
                entityId: data.id
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('Successfully refreshed Google Places image for new entity:', result);
              
              // Update the entity with the new image URL if one was returned
              if (result.imageUrl) {
                await supabase
                  .from('entities')
                  .update({ image_url: result.imageUrl })
                  .eq('id', data.id);
              }
            } else {
              console.error('Failed to refresh Google Places image for new entity:', await response.text());
            }
          } else {
            console.warn('No active session to refresh Google Places image for new entity');
          }
        } catch (refreshError) {
          console.error('Error refreshing Google Places image for new entity:', refreshError);
          // Continue with original URL if refresh fails
        }
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
      let storedImageUrl = null;
      
      // If we have a valid image URL, try to save it to our storage
      if (imageUrl && isValidImageUrl(imageUrl)) {
        try {
          // Download and store the external image
          storedImageUrl = await saveExternalImageToStorage(imageUrl, entityId);
          
          if (storedImageUrl) {
            console.log(`Successfully saved image from URL metadata to storage: ${storedImageUrl}`);
            imageUrl = storedImageUrl;
          } else {
            console.warn(`Failed to save image from URL metadata to storage, using original URL`);
          }
        } catch (imageError) {
          console.error('Error saving image from URL metadata to storage:', imageError);
          // Keep the original URL if storage fails
        }
      }
      
      // Create entity from the metadata
      const entityData = {
        name: data.metadata.title || data.metadata.og_title || url.split('/').pop() || 'Untitled',
        type: type as any, // Cast to any to handle extended entity types
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
