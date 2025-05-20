
import { useState } from 'react';
import { refreshEntityImage } from '@/services/recommendation/entityOperations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Entity = {
  id: string;
  name: string;
  api_ref?: string;
  api_source?: string;
  metadata?: any;
};

type RecoveryStatus = 'idle' | 'loading' | 'success' | 'error' | 'missing_reference';

type RecoveryResult = {
  status: RecoveryStatus;
  message?: string;
  updatedImageUrl?: string | null;
};

/**
 * Hook for managing entity photo recovery operations
 */
export const useEntityPhotoRecovery = () => {
  const [isRecovering, setIsRecovering] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  /**
   * Check if an entity has a valid photo reference
   */
  const hasPhotoReference = (entity: Entity): boolean => {
    return !!(entity.metadata?.photo_reference);
  };

  /**
   * Attempt to recover an entity's image from Google Places API
   */
  const recoverImage = async (entity: Entity): Promise<RecoveryResult> => {
    if (!entity) {
      return {
        status: 'error',
        message: 'Entity not provided'
      };
    }
    
    if (!entity.api_source || entity.api_source !== 'google_places') {
      return {
        status: 'error',
        message: 'Only Google Places entities are supported'
      };
    }
    
    if (!hasPhotoReference(entity)) {
      return {
        status: 'missing_reference',
        message: 'Entity is missing a photo reference'
      };
    }
    
    setIsRecovering(prev => ({ ...prev, [entity.id]: true }));
    
    try {
      const success = await refreshEntityImage(entity.id);
      
      if (success) {
        // Fetch the updated entity to get the new image URL
        const { data: updatedEntity } = await supabase
          .from('entities')
          .select('image_url')
          .eq('id', entity.id)
          .single();
        
        return {
          status: 'success',
          message: `Successfully recovered image for ${entity.name}`,
          updatedImageUrl: updatedEntity?.image_url
        };
      } else {
        return {
          status: 'error',
          message: `Failed to recover image for ${entity.name}`
        };
      }
    } catch (error) {
      console.error('Error in recoverImage:', error);
      return {
        status: 'error',
        message: `Error: ${(error as Error).message}`
      };
    } finally {
      setIsRecovering(prev => ({ ...prev, [entity.id]: false }));
    }
  };

  return {
    recoverImage,
    hasPhotoReference,
    isRecovering
  };
};
