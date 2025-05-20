
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
      
      // Show a toast to let the user know we're processing
      toast({
        title: 'Refreshing image...',
        description: 'This may take a few seconds'
      });
      
      // Use the processEntityImage function from the service
      const processedImageUrl = await processEntityImage(
        entityId,
        imageUrl,
        photoReference,
        placeId
      );
      
      if (processedImageUrl && processedImageUrl !== imageUrl) {
        console.log(`Successfully refreshed image to: ${processedImageUrl}`);
        
        // Update the entity with the refreshed URL
        const { error: updateError } = await supabase
          .from('entities')
          .update({ image_url: processedImageUrl })
          .eq('id', entityId);
          
        if (updateError) {
          console.error('Error updating entity with refreshed image:', updateError);
          toast({
            title: 'Error updating entity',
            description: 'The image was saved but could not update the entity record',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Image refreshed',
            description: 'The entity image has been successfully updated'
          });
        }
        
        return processedImageUrl;
      }
      
      console.warn(`Image refresh did not change URL: ${imageUrl}`);
      toast({
        title: 'No change needed',
        description: 'The image is already up to date'
      });
      return imageUrl; // Return original URL as it didn't change
    } catch (error) {
      console.error('Error refreshing entity image:', error);
      toast({
        title: 'Error refreshing image',
        description: 'Could not refresh the entity image. Please try again.',
        variant: 'destructive'
      });
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

      console.log('Creating entity with details:', {
        name,
        type,
        apiSource,
        apiRef,
        venue,
        imageUrl: imageUrl ? (imageUrl.length > 100 ? imageUrl.substring(0, 100) + '...' : imageUrl) : null,
        hasMetadata: metadata ? true : false
      });

      // Create the entity
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

      // Special handling for Google Places entities: if the image is still from Google Maps
      // and we have a photo reference, try to manually refresh it
      if (
        entity.api_source === 'google_places' && 
        entity.image_url && 
        entity.image_url.includes('maps.googleapis.com') &&
        metadata?.photo_reference
      ) {
        console.log('Entity created, but image is still from Google Maps API. Manually refreshing...');
        
        // Wait a moment before refreshing (to ensure entity is fully created)
        setTimeout(async () => {
          const refreshedImageUrl = await refreshEntityImage(
            entity.id,
            entity.image_url,
            metadata.photo_reference,
            entity.api_ref
          );
          
          if (refreshedImageUrl && refreshedImageUrl !== entity.image_url) {
            console.log('Successfully refreshed entity image after creation:', refreshedImageUrl);
          } else {
            console.warn('Manual refresh after creation did not change the image URL');
          }
        }, 1000);
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
