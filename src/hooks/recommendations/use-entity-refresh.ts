
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveExternalImageToStorage } from '@/utils/imageUtils';

export const useEntityImageRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const refreshEntityImage = async (entityId: string, placeId?: string, photoReference?: string): Promise<string | null> => {
    if (!entityId) {
      console.error('Entity ID is required to refresh image');
      return null;
    }

    setIsRefreshing(true);
    
    try {
      // For Google Places entities, use the edge function
      if (placeId) {
        const response = await fetch(`https://uyjtgybbktgapspodajy.supabase.co/functions/v1/refresh-entity-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.auth.getSession()}`
          },
          body: JSON.stringify({
            placeId,
            photoReference,
            entityId
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to refresh entity image');
        }

        const { imageUrl } = await response.json();
        
        toast({
          title: 'Image refreshed',
          description: 'The entity image has been successfully updated.'
        });

        return imageUrl;
      } 
      // For non-Google Places entities, retrieve current image and migrate it
      else {
        // Get current entity data
        const { data: entity, error } = await supabase
          .from('entities')
          .select('image_url')
          .eq('id', entityId)
          .single();

        if (error) {
          throw new Error(`Error fetching entity: ${error.message}`);
        }

        if (!entity?.image_url) {
          toast({
            title: 'No image to refresh',
            description: 'This entity does not have an image to refresh.',
            variant: 'destructive'
          });
          return null;
        }

        // Migrate the external image to our storage
        const newImageUrl = await saveExternalImageToStorage(entity.image_url, entityId);
        
        if (!newImageUrl) {
          throw new Error('Failed to save entity image to storage');
        }
        
        // Update the entity record with the new image URL
        const { error: updateError } = await supabase
          .from('entities')
          .update({ image_url: newImageUrl })
          .eq('id', entityId);
          
        if (updateError) {
          throw new Error(`Error updating entity: ${updateError.message}`);
        }

        toast({
          title: 'Image saved',
          description: 'The entity image has been saved to our storage.'
        });
        
        return newImageUrl;
      }
    } catch (error) {
      console.error('Error refreshing entity image:', error);
      
      toast({
        title: 'Error refreshing image',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive'
      });
      
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  return { refreshEntityImage, isRefreshing };
};
