
import { useState } from 'react';
import { useRecommendationsFetch } from './use-recommendations-fetch';
import { useAuth } from '@/contexts/AuthContext';
import { 
  toggleLike, 
  toggleSave
} from '@/services/recommendationService';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useRecommendationFilters } from './use-recommendation-filters';
import { Recommendation } from '@/services/recommendation/types';

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
  
  // Fetch recommendations data
  const { 
    recommendations,
    isLoading,
    error,
    refreshRecommendations
  } = useRecommendationsFetch({ profileUserId });
  
  // Apply filters and sorting
  const {
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    filteredRecommendations,
    categories,
    clearFilters
  } = useRecommendationFilters(recommendations);

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
      await toggleLike(id, user.id);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert on failure
      refreshRecommendations();
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
      await toggleSave(id, user.id);
    } catch (err) {
      console.error('Error toggling save:', err);
      // Revert on failure
      refreshRecommendations();
      toast({
        title: "Error",
        description: "Failed to update save status",
        variant: "destructive"
      });
    }
  };

  // Stub functions to satisfy the interface
  const handleImageUpload = async (file: File): Promise<string | null> => {
    // Implementation would go here
    return null;
  };

  const addRecommendation = async (recommendation: Partial<Recommendation>): Promise<boolean> => {
    // Implementation would go here
    return false;
  };

  return {
    recommendations: filteredRecommendations,
    isLoading,
    error: error,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    handleLike,
    handleSave,
    handleImageUpload,
    addRecommendation,
    clearFilters,
    refreshRecommendations
  };
};
