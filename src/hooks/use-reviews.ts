
import { useState, useCallback } from 'react';
import { useReviewsFetch } from './reviews/use-reviews-fetch';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { 
  toggleReviewLike, 
  Review
} from '@/services/reviewService';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface UseReviewsProps {
  profileUserId: string;
}

export const useReviews = ({ profileUserId }: UseReviewsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { requireAuth } = useAuthPrompt();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const queryClient = useQueryClient();
  
  const { 
    data: reviews,
    isLoading,
    error,
    refetch
  } = useReviewsFetch({ profileUserId });

  const handleLike = async (id: string) => {
    if (!requireAuth({ action: 'like', surface: 'review_card' })) return;

    // Email verification gate (Phase 2 — UI only)
    if (!canPerformAction('canLikeContent')) {
      showVerificationRequired('canLikeContent');
      return;
    }

    try {
      // Optimistic update
      queryClient.setQueryData(['reviews', profileUserId, user.id], 
        (old: Review[]) => old?.map((item: Review) => {
          if (item.id === id) {
            const isLiked = !item.isLiked;
            return {
              ...item,
              isLiked,
              likes: isLiked 
                ? (item.likes || 0) + 1 
                : Math.max(0, (item.likes || 0) - 1)
            };
          }
          return item;
        })
      );

      // Server update
      await toggleReviewLike(id, user.id);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert on failure
      refetch();
      toast({
        title: "Error",
        description: "Failed to update like status",
        variant: "destructive"
      });
    }
  };


  const refreshReviews = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    reviews,
    isLoading,
    error,
    handleLike,
    refreshReviews
  };
};
