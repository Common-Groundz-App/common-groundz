
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Entity,
  EntityType,
  findOrCreateEntity,
  getEntitiesByType,
  processEntityImage
} from '@/services/recommendationService';
import { supabase } from '@/integrations/supabase/client';

export const useEntityOperations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);

  const fetchUrlMetadata = async (url: string): Promise<any> => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-url-metadata', {
        body: { url }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching URL metadata:', error);
      return null;
    }
  };

  const refreshEntityImage = async (entityId: string, imageUrl: string, photoReference?: string, placeId?: string): Promise<string | null> => {
    try {
      console.log(`Manually refreshing image for entity ${entityId}`);
      
      // Use the processEntityImage function from the service
      const processedImageUrl = await processEntityImage(
        entityId,
        imageUrl,
        photoReference,
        placeId
      );
      
      if (processedImageUrl && processedImageUrl !== imageUrl) {
        console.log(`Successfully refreshed image to: ${processedImageUrl}`);
        return processedImageUrl;
      }
      
      console.warn(`Image refresh did not change URL: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      console.error('Error refreshing entity image:', error);
      return imageUrl; // Return original URL as fallback
    }
  };

  const handleEntityCreation = async (
    name: string,
    type: EntityType,
    apiSource: string | null = null,
    apiRef: string | null = null,
    venue: string | null = null,
    description: string | null = null,
    imageUrl: string | null = null,
    metadata: any | null = null,
    websiteUrl: string | null = null
  ): Promise<Entity | null> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create entities',
        variant: 'destructive'
      });
      return null;
    }

    try {
      setIsLoading(true);

      if (websiteUrl) {
        const urlMetadata = await fetchUrlMetadata(websiteUrl);
        if (urlMetadata) {
          name = name || urlMetadata.title;
          description = description || urlMetadata.description;
          imageUrl = imageUrl || urlMetadata.image;
          metadata = {
            ...metadata,
            openGraph: urlMetadata
          };
        }
      }

      // Create the entity (findOrCreateEntity handles automatic image processing)
      const entity = await findOrCreateEntity(
        name,
        type,
        apiSource,
        apiRef,
        venue,
        description,
        imageUrl,
        metadata,
        user.id,
        websiteUrl
      );

      if (!entity) {
        toast({
          title: 'Error',
          description: 'Failed to create entity',
          variant: 'destructive'
        });
        return null;
      }

      // For Google Places entities, if the image URL still contains the API URL,
      // try to manually refresh the image
      if (
        entity.api_source === 'google_places' && 
        entity.image_url && 
        entity.image_url.includes('maps.googleapis.com') &&
        metadata?.photo_reference
      ) {
        console.log('Original image is from Google Maps API, refreshing...');
        
        const refreshedImageUrl = await refreshEntityImage(
          entity.id,
          entity.image_url,
          metadata.photo_reference,
          entity.api_ref
        );
        
        if (refreshedImageUrl && refreshedImageUrl !== entity.image_url) {
          // Update the entity with the refreshed image
          const { error } = await supabase
            .from('entities')
            .update({ image_url: refreshedImageUrl })
            .eq('id', entity.id);
            
          if (error) {
            console.error('Error updating entity with refreshed image:', error);
          } else {
            entity.image_url = refreshedImageUrl;
          }
        }
      }

      return entity;
    } catch (error) {
      console.error('Error in handleEntityCreation:', error);
      toast({
        title: 'Error',
        description: 'Failed to create entity. Please try again.',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const searchEntities = async (type: EntityType, searchTerm: string = ''): Promise<Entity[]> => {
    try {
      setIsLoading(true);
      const searchResults = await getEntitiesByType(type, searchTerm);
      setEntities(searchResults);
      return searchResults;
    } catch (error) {
      console.error('Error searching entities:', error);
      toast({
        title: 'Error',
        description: 'Failed to search entities. Please try again.',
        variant: 'destructive'
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    entities,
    isLoading,
    handleEntityCreation,
    searchEntities,
    refreshEntityImage
  };
};
