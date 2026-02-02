
import { useState, useCallback } from 'react';
import { useReviewsFetch } from './reviews/use-reviews-fetch';
import { useAuth } from '@/contexts/AuthContext';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { 
  toggleReviewLike, 
  toggleReviewSave,
  convertReviewToRecommendation,
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
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const queryClient = useQueryClient();
  
  const { 
    data: reviews,
    isLoading,
    error,
    refetch
  } = useReviewsFetch({ profileUserId });

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to like reviews",
        variant: "destructive"
      });
      return;
    }

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

  const handleSave = async (id: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save reviews",
        variant: "destructive"
      });
      return;
    }

    try {
      // Optimistic update
      queryClient.setQueryData(['reviews', profileUserId, user.id], 
        (old: Review[]) => old?.map((item: Review) => {
          if (item.id === id) {
            return {
              ...item,
              isSaved: !item.isSaved,
            };
          }
          return item;
        })
      );

      // Server update
      await toggleReviewSave(id, user.id);
    } catch (err) {
      console.error('Error toggling save:', err);
      // Revert on failure
      refetch();
      toast({
        title: "Error",
        description: "Failed to update save status",
        variant: "destructive"
      });
    }
  };

  const refreshReviews = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const convertToRecommendation = async (reviewId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to convert reviews",
        variant: "destructive"
      });
      return;
    }

    try {
      const success = await convertReviewToRecommendation(reviewId);
      
      if (success) {
        toast({
          title: "Review converted",
          description: "Your review has been converted to a recommendation",
        });
        
        // Refresh data
        await refreshReviews();
      } else {
        toast({
          title: "Error",
          description: "Failed to convert review to recommendation",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error converting review:', err);
      toast({
        title: "Error",
        description: "Failed to convert review to recommendation",
        variant: "destructive"
      });
    }
  };

  return {
    reviews,
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshReviews,
    convertToRecommendation
  };
};
