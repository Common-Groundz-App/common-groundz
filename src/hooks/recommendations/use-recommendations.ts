
import { useState } from 'react';
import { useRecommendationsFetch } from './use-recommendations-fetch';
import { useAuth } from '@/contexts/AuthContext';
import { 
  toggleLike, 
  toggleSave,
  RecommendationCategory
} from '@/services/recommendationService';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useRecommendationFilters } from './use-recommendation-filters';
import { Recommendation } from '@/services/recommendation/types';
import { useContentMutationManager } from '@/hooks/use-content-mutation-manager';

interface UseRecommendationsProps {
  profileUserId?: string;
  category?: string | RecommendationCategory;
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
  const contentMutation = useContentMutationManager();
  
  // Fetch recommendations data
  const { 
    recommendations,
    isLoading,
    error,
    refreshRecommendations
  } = useRecommendationsFetch({ 
    profileUserId,
    category,
    limit 
  });
  
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
      // Get the current recommendation being modified
      const recommendation = recommendations?.find(rec => rec.id === id);
      if (!recommendation) return;
      
      // Optimistic update using the mutation manager
      contentMutation.optimisticUpdate<Recommendation>(
        'recommendation',
        id,
        (item) => ({
          ...item,
          isLiked: !item.isLiked,
          likes: item.isLiked 
            ? Math.max(0, (item.likes || 0) - 1) 
            : (item.likes || 0) + 1
        })
      );

      // Server update - Pass the current like status as the third argument
      await toggleLike(id, user.id, !!(recommendation.isLiked));
      
      // Notify mutation manager of completed action
      contentMutation.mutationCompleted('recommendation', 'like', undefined, user.id);
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
      // Get the current recommendation being modified
      const recommendation = recommendations?.find(rec => rec.id === id);
      if (!recommendation) return;
      
      // Optimistic update using the mutation manager
      contentMutation.optimisticUpdate<Recommendation>(
        'recommendation',
        id,
        (item) => ({
          ...item,
          isSaved: !item.isSaved
        })
      );

      // Server update - Pass the current save status as the third argument
      await toggleSave(id, user.id, !!(recommendation.isSaved));
      
      // Notify mutation manager of completed action
      contentMutation.mutationCompleted('recommendation', 'save', undefined, user.id);
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
