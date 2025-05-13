
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export type ContentType = 'post' | 'review' | 'recommendation';
export type MutationType = 'create' | 'update' | 'delete' | 'like' | 'save' | 'comment';
export type ImpactLevel = 'high' | 'medium' | 'low';

interface MutationOptions {
  showToast?: boolean;
  toastMessage?: {
    title: string;
    description: string;
  };
}

/**
 * A hook that manages mutations and cache invalidation for different content types
 * to ensure consistent data refreshing across the application.
 */
export const useContentMutationManager = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Get the impact level of a mutation based on its type
   */
  const getMutationImpact = (mutationType: MutationType): ImpactLevel => {
    switch (mutationType) {
      case 'create':
      case 'update':
      case 'delete':
        return 'high';
      case 'comment':
        return 'medium';
      case 'like':
      case 'save':
        return 'low';
      default:
        return 'medium';
    }
  };

  /**
   * Get the query keys associated with a content type
   */
  const getQueryKeys = (contentType: ContentType): string[] => {
    switch (contentType) {
      case 'post':
        return ['posts', 'feed', 'profile-posts'];
      case 'review':
        return ['reviews'];
      case 'recommendation':
        return ['recommendations'];
      default:
        return [contentType];
    }
  };

  /**
   * Invalidate queries for a given content type based on impact level
   */
  const invalidateContentQueries = (
    contentType: ContentType, 
    impactLevel: ImpactLevel,
    userId?: string
  ) => {
    const queryKeys = getQueryKeys(contentType);
    
    if (impactLevel === 'high') {
      // For high impact, invalidate all related queries
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
        
        // If user ID provided, also invalidate user-specific queries
        if (userId) {
          queryClient.invalidateQueries({ queryKey: [key, userId] });
        }
      });
      
      // For certain content types, dispatch global refresh events
      if (contentType === 'post') {
        window.dispatchEvent(new CustomEvent('refresh-feed'));
        window.dispatchEvent(new CustomEvent('refresh-posts'));
        window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
      } else if (contentType === 'recommendation') {
        window.dispatchEvent(new CustomEvent('refresh-recommendations'));
      } else if (contentType === 'review') {
        window.dispatchEvent(new CustomEvent('refresh-reviews'));
      }
    } else if (impactLevel === 'medium') {
      // For medium impact, be more selective about which queries to invalidate
      if (contentType === 'post' && userId) {
        queryClient.invalidateQueries({ queryKey: ['posts', userId] });
      } else {
        queryClient.invalidateQueries({ queryKey: [contentType] });
      }
    }
    // For low impact, we don't invalidate queries as they are handled via optimistic updates
  };
  
  /**
   * Trigger the appropriate refresh strategy after a mutation
   */
  const mutationCompleted = (
    contentType: ContentType, 
    mutationType: MutationType, 
    options?: MutationOptions,
    userId?: string
  ) => {
    const impactLevel = getMutationImpact(mutationType);
    
    // Handle cache invalidation
    invalidateContentQueries(contentType, impactLevel, userId);
    
    // Show toast notification if requested
    if (options?.showToast && options.toastMessage) {
      toast({
        title: options.toastMessage.title,
        description: options.toastMessage.description,
      });
    }
    
    return true;
  };

  /**
   * Handle optimistic updates for low-impact mutations like likes and saves
   * Updated to use generic type parameter for better type safety
   */
  const optimisticUpdate = <T extends { id: string }>(
    contentType: ContentType,
    itemId: string,
    updateFn: (item: T) => T,
  ) => {
    const queryKeys = getQueryKeys(contentType);
    
    queryKeys.forEach(queryKey => {
      queryClient.setQueryData([queryKey], (oldData: any) => {
        if (!oldData) return oldData;
        
        // Handle both array and object data structures
        if (Array.isArray(oldData)) {
          return oldData.map(item => 
            item.id === itemId ? updateFn(item as T) : item
          );
        } else if (oldData.items && Array.isArray(oldData.items)) {
          return {
            ...oldData,
            items: oldData.items.map((item: any) => 
              item.id === itemId ? updateFn(item as T) : item
            )
          };
        }
        
        return oldData;
      });
    });
  };

  return {
    mutationCompleted,
    optimisticUpdate,
    getMutationImpact
  };
};

export default useContentMutationManager;
