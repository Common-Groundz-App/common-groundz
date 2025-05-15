
import { useState, useEffect } from 'react';
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
  
  console.log(`useRecommendations for profileUserId: ${profileUserId}`);
  
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
  
  // Make sure we have an array to work with even if we get null/undefined
  const safeRecommendations = recommendations || [];
  
  // Apply filters and sorting
  const {
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    filteredRecommendations,
    categories,
    clearFilters
  } = useRecommendationFilters(safeRecommendations);

  // Log the recommendations we're working with
  useEffect(() => {
    console.log(`Recommendations in useRecommendations: ${safeRecommendations.length}`);
  }, [safeRecommendations]);

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
      // Find the recommendation to toggle
      const recommendation = safeRecommendations.find(rec => rec.id === id);
      if (!recommendation) {
        console.error('Recommendation not found:', id);
        return;
      }

      // Optimistic update
      const prevData = [...safeRecommendations];
      
      // Update local state
      queryClient.setQueryData(['recommendations', profileUserId, user.id], 
        (old: any) => {
          if (!old || !Array.isArray(old?.recommendations)) {
            console.warn('Invalid query data structure', old);
            return old;
          }
          
          return {
            ...old,
            recommendations: old.recommendations.map((item: any) => {
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
          };
        }
      );

      // Server update - Pass the current like status as the third argument
      await toggleLike(id, user.id, !!(recommendation?.isLiked));
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
      // Find the recommendation to toggle
      const recommendation = safeRecommendations.find(rec => rec.id === id);
      if (!recommendation) {
        console.error('Recommendation not found:', id);
        return;
      }

      // Optimistic update
      queryClient.setQueryData(['recommendations', profileUserId, user.id], 
        (old: any) => {
          if (!old || !Array.isArray(old?.recommendations)) {
            console.warn('Invalid query data structure', old);
            return old;
          }
          
          return {
            ...old,
            recommendations: old.recommendations.map((item: any) => {
              if (item.id === id) {
                return {
                  ...item,
                  isSaved: !item.isSaved,
                };
              }
              return item;
            })
          };
        }
      );

      // Server update - Pass the current save status as the third argument
      await toggleSave(id, user.id, !!(recommendation?.isSaved));
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
