
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  findOrCreateEntity, 
  EntityType,
  uploadRecommendationImage 
} from '@/services/recommendationService';
import { Database } from '@/integrations/supabase/types';

export const useEntityOperations = () => {
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const { toast } = useToast();

  const createEntity = async (
    name: string,
    type: EntityType,
    venue?: string,
    imageFile?: File,
    metadata?: Record<string, any>
  ) => {
    setIsCreatingEntity(true);
    try {
      let imageUrl: string | undefined;
      
      if (imageFile) {
        imageUrl = await uploadRecommendationImage(imageFile);
      }

      const entity = await findOrCreateEntity(
        name,
        type,
        venue,
        imageUrl,
        undefined, // apiRef
        undefined, // apiSource
        metadata || {},
        undefined, // description
        undefined, // websiteUrl
        undefined, // categoryId
        undefined, // photoReference
        undefined, // authors
        undefined, // publicationYear
        undefined, // isbn
        undefined, // languages
        undefined, // externalRatings
        undefined, // priceInfo
        undefined, // specifications
        undefined, // castCrew
        undefined, // ingredients
        undefined  // nutritionalInfo
      );

      toast({
        title: "Entity created",
        description: `${entity.name} has been created successfully.`
      });

      return entity;
    } catch (error) {
      console.error('Error creating entity:', error);
      toast({
        title: "Error",
        description: "Failed to create entity. Please try again.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsCreatingEntity(false);
    }
  };

  return {
    createEntity,
    isCreatingEntity
  };
};
