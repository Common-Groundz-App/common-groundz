
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  toggleReviewLike, 
  toggleReviewSave,
  convertReviewToRecommendation 
} from '@/services/reviewService';
import { useReviewsFetch } from './reviews/use-reviews-fetch';

interface UseReviewsProps {
  profileUserId: string;
}

export const useReviews = ({ profileUserId }: UseReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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

      // Optimistic update
      queryClient.setQueryData(['reviews', profileUserId, user.id], 
        (old: any) => old?.map((item: any) => {
          if (item.id === id) {
            const isLiked = !item.isLiked;
            return {
              ...item,
              isLiked,
              likes: (item.likes || 0) + (isLiked ? 1 : -1)
            };
          }
          return item;
        })
      );

      // Server update
      await toggleReviewLike(id, user.id, !!item.isLiked);
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
  }, [reviews, user, toast, profileUserId, refetch, queryClient]);

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

      // Optimistic update
      queryClient.setQueryData(['reviews', profileUserId, user.id], 
        (old: any) => old?.map((item: any) => {
          if (item.id === id) {
            return {
              ...item,
              isSaved: !item.isSaved
            };
          }
          return item;
        })
      );

      // Server update
      await toggleReviewSave(id, user.id, !!item.isSaved);
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
  }, [reviews, user, toast, profileUserId, refetch, queryClient]);

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
      
      // Refresh the list
      refetch();
    } catch (err) {
      console.error('Error converting review:', err);
      toast({
        title: 'Error',
        description: 'Failed to convert review. Please try again.',
        variant: 'destructive'
      });
    }
  }, [user, toast, refetch]);

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
