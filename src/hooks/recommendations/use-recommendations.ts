
import { useState } from 'react';
import { useRecommendationsFetch } from './use-recommendations-fetch';
import { useAuth } from '@/contexts/AuthContext';
import { 
  toggleRecommendationLike,
  toggleRecommendationSave
} from '@/services/recommendation/interactionOperations';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface UseRecommendationsProps {
  profileUserId?: string;
  category?: string;
  limit?: number;
  filterOptions?: {
    sort?: 'latest' | 'highestRated' | 'mostLiked';
    minRating?: number;
    isCertifiedOnly?: boolean;
  };
}

export const useRecommendations = ({ 
  profileUserId, 
  category,
  limit,
  filterOptions
}: UseRecommendationsProps = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { 
    data: recommendations,
    isLoading,
    isError,
    error,
    refetch
  } = useRecommendationsFetch({ 
    profileUserId, 
    category,
    limit,
    sort: filterOptions?.sort,
    minRating: filterOptions?.minRating,
    isCertifiedOnly: filterOptions?.isCertifiedOnly
  });

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to like recommendations",
        variant: "destructive"
      });
      return;
    }

    try {
      // Optimistic update
      const prevData = [...(recommendations || [])];
      
      // Update local state
      queryClient.setQueryData(['recommendations', profileUserId, user.id], 
        (old: any) => old?.map((item: any) => {
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
      await toggleRecommendationLike(id, user.id);
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
        description: "Please sign in to save recommendations",
        variant: "destructive"
      });
      return;
    }

    try {
      // Optimistic update
      queryClient.setQueryData(['recommendations', profileUserId, user.id], 
        (old: any) => old?.map((item: any) => {
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
      await toggleRecommendationSave(id, user.id);
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

  return {
    recommendations,
    isLoading,
    error: isError ? error : null,
    handleLike,
    handleSave,
    refreshRecommendations: refetch
  };
};
