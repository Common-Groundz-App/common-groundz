
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchUrlMetadata } from '@/services/urlMetadataService';
import { findOrCreateEntity, Entity, EntityType } from '@/services/recommendationService';

export const useUrlEntityCreator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

  const createEntityFromUrl = async (url: string, type: EntityType): Promise<Entity | null> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create entities from URLs',
      });
      return null;
    }

    try {
      setIsLoading(true);
      
      // Fetch metadata from the URL
      const urlMetadata = await fetchUrlMetadata(url);
      if (!urlMetadata) {
        toast({
          title: 'Error',
          description: 'Could not fetch metadata from this URL',
          variant: 'destructive',
        });
        return null;
      }

      setMetadata(urlMetadata);
      
      // Create entity using the metadata
      const name = urlMetadata.title || url;
      const description = urlMetadata.description || null;
      const imageUrl = urlMetadata.image || null;
      
      // Store the full metadata in the entity's metadata field
      const entity = await findOrCreateEntity(
        name,
        type,
        'url', // api_source
        url,   // api_ref (using the URL itself as reference)
        null,  // venue
        description,
        imageUrl,
        { ...urlMetadata },
        user.id
      );

      if (!entity) {
        toast({
          title: 'Error',
          description: 'Failed to create entity from URL',
          variant: 'destructive',
        });
        return null;
      }

      toast({
        title: 'Success',
        description: `Created ${type} entity: ${name}`,
      });

      return entity;
    } catch (error) {
      console.error('Error creating entity from URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to create entity from URL.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createEntityFromUrl,
    metadata,
    isLoading,
  };
};
