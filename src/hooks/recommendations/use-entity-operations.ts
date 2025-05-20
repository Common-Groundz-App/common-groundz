
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Entity,
  EntityType,
  findOrCreateEntity,
  getEntitiesByType
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

      // findOrCreateEntity will now automatically handle image processing
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
    searchEntities
  };
};
