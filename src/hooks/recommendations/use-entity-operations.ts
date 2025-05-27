
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

  const searchGoogleBooks = async (query: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('search-google-books', {
        body: { query, maxResults: 20 }
      });

      if (error) throw error;
      return data?.results || [];
    } catch (error) {
      console.error('Error searching Google Books:', error);
      return [];
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

      // Validate and correct entity type based on API source
      let correctedType = type;
      if (apiSource) {
        correctedType = getCorrectEntityType(apiSource, type);
        if (correctedType !== type) {
          console.log(`🔧 Corrected entity type from ${type} to ${correctedType} based on API source: ${apiSource}`);
        }
      }

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

      const entity = await findOrCreateEntity(
        name,
        correctedType,
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
      let allResults: Entity[] = [];
      
      // Get existing entities from database
      const existingResults = await getEntitiesByType(type, searchTerm);
      allResults = [...existingResults];
      
      // For books, also search Google Books API
      if (type === 'book' && searchTerm.trim()) {
        try {
          const googleBooksResults = await searchGoogleBooks(searchTerm);
          
          // Filter out any that already exist in our database by comparing names and authors
          const filteredGoogleResults = googleBooksResults.filter(googleBook => {
            return !existingResults.some(existing => {
              const nameMatch = existing.name.toLowerCase() === googleBook.name.toLowerCase();
              const authorMatch = existing.authors?.[0]?.toLowerCase() === googleBook.authors?.[0]?.toLowerCase();
              return nameMatch && authorMatch;
            });
          });
          
          allResults = [...allResults, ...filteredGoogleResults];
        } catch (error) {
          console.error('Error searching Google Books:', error);
          // Continue with just database results if Google Books fails
        }
      }
      
      setEntities(allResults);
      return allResults;
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
    searchGoogleBooks
  };
};

// Helper function to ensure correct entity type based on API source
const getCorrectEntityType = (apiSource: string, originalType: EntityType): EntityType => {
  const apiSourceMapping: Record<string, EntityType> = {
    'openlibrary': EntityType.Book,
    'google_books': EntityType.Book,
    'omdb': EntityType.Movie,
    'tmdb': EntityType.Movie,
    'google_places': EntityType.Place
  };
  
  const correctedType = apiSourceMapping[apiSource];
  if (correctedType && correctedType !== originalType) {
    console.warn(`⚠️ API source ${apiSource} should map to ${correctedType}, but got ${originalType}. Correcting automatically.`);
    return correctedType;
  }
  
  return originalType;
};
