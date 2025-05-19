
import { useState } from 'react';
import { refreshEntityImage } from '@/services/recommendation/entityOperations';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for refreshing entity images from their original source
 */
export const useEntityRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  /**
   * Attempt to refresh an entity's image from its original source
   * Currently works for Google Places entities
   */
  const refreshImage = async (entityId: string): Promise<boolean> => {
    setIsRefreshing(true);
    try {
      const success = await refreshEntityImage(entityId);
      
      if (success) {
        toast({
          title: 'Image refreshed',
          description: 'The entity image has been updated.',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Could not refresh image',
          description: 'The entity type may not support image refreshing.',
          variant: 'destructive'
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error refreshing entity image:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh entity image.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    refreshImage,
    isRefreshing
  };
};
