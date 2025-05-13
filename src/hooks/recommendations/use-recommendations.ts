
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Review } from '@/services/reviewService';
import { useAuth } from '@/contexts/AuthContext';
import { 
  toggleReviewLike,
  toggleReviewSave,
  convertReviewToRecommendation
} from '@/services/reviewService';
import { useReviewsFetch } from './use-reviews-fetch';

interface UseRecommendationsProps {
  profileUserId: string;
}

export const useRecommendations = ({ profileUserId }: UseRecommendationsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Use the React Query hook for data fetching
  const {
    data: reviews,
    isLoading,
    error,
    refetch: refreshReviews
  } = useReviewsFetch({ profileUserId });
  
  // Handle like action
  const handleLike = async (id: string) => {
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
      // Note: We don't need to manually update state as react-query will handle refetching

      // Server update
      await toggleReviewLike(id, user.id, !!item.isLiked);
      refreshReviews();
    } catch (err) {
      console.error('Error toggling like:', err);
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle save action
  const handleSave = async (id: string) => {
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

      // Server update
      await toggleReviewSave(id, user.id, !!item.isSaved);
      refreshReviews();
    } catch (err) {
      console.error('Error toggling save:', err);
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Convert to recommendation
  const convertToRecommendation = async (id: string) => {
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
      refreshReviews();
    } catch (err) {
      console.error('Error converting review:', err);
      toast({
        title: 'Error',
        description: 'Failed to convert review. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return {
    reviews: reviews || [],
    isLoading,
    error,
    handleLike,
    handleSave,
    refreshReviews,
    convertToRecommendation
  };
};
