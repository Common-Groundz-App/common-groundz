
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  toggleReviewLike, 
  toggleReviewSave,
  convertReviewToRecommendation,
  Review 
} from '@/services/reviewService';
import { useReviewsFetch } from './reviews/use-reviews-fetch';
import { useContentMutationManager } from './use-content-mutation-manager';
import { ReviewOptimisticUpdateProps } from './feed/types';

interface UseReviewsProps {
  profileUserId: string;
}

export const useReviews = ({ profileUserId }: UseReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const contentMutation = useContentMutationManager();
  
  const {
    data: reviews,
    isLoading,
    isError,
    error,
    refetch
  } = useReviewsFetch({ profileUserId });

  // Handle like action
  const handleLike = useCallback(async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like reviews',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = reviews?.find(r => r.id === id);
      if (!item) return;

      // Optimistic update using the mutation manager with proper typing
      contentMutation.optimisticUpdate<ReviewOptimisticUpdateProps>(
        'review',
        id,
        (item) => ({
          ...item,
          isLiked: !item.isLiked,
          likes: (item.likes || 0) + (!item.isLiked ? 1 : -1)
        })
      );

      // Server update
      await toggleReviewLike(id, user.id, !!item.isLiked);
      
      // Notify mutation manager of completed action
      contentMutation.mutationCompleted('review', 'like', undefined, user.id);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert on failure
      refetch();
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
    }
  }, [reviews, user, toast, profileUserId, refetch, contentMutation]);

  // Handle save action
  const handleSave = useCallback(async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save reviews',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = reviews?.find(r => r.id === id);
      if (!item) return;

      // Optimistic update using the mutation manager with proper typing
      contentMutation.optimisticUpdate<ReviewOptimisticUpdateProps>(
        'review',
        id,
        (item) => ({
          ...item,
          isSaved: !item.isSaved
        })
      );

      // Server update
      await toggleReviewSave(id, user.id, !!item.isSaved);
      
      // Notify mutation manager of completed action
      contentMutation.mutationCompleted('review', 'save', undefined, user.id);
    } catch (err) {
      console.error('Error toggling save:', err);
      // Revert on failure
      refetch();
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
    }
  }, [reviews, user, toast, profileUserId, refetch, contentMutation]);

  // Convert to recommendation
  const convertToRecommendation = useCallback(async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to convert reviews',
        variant: 'destructive'
      });
      return;
    }

    try {
      await convertReviewToRecommendation(id, user.id);
      
      toast({
        title: 'Success',
        description: 'Review successfully converted to recommendation'
      });
      
      // Use the mutation manager for high-impact changes
      contentMutation.mutationCompleted(
        'review', 
        'delete', 
        {
          showToast: false
        },
        user.id
      );
      
      // Also invalidate recommendations since a new one was created
      contentMutation.mutationCompleted('recommendation', 'create', undefined, user.id);
    } catch (err) {
      console.error('Error converting review:', err);
      toast({
        title: 'Error',
        description: 'Failed to convert review. Please try again.',
        variant: 'destructive'
      });
    }
  }, [user, toast, contentMutation]);

  return {
    reviews,
    isLoading,
    error: isError ? error : null,
    handleLike,
    handleSave,
    refreshReviews: refetch,
    convertToRecommendation
  };
};
