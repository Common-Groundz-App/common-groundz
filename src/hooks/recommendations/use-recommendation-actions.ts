import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Recommendation,
  toggleLike,
  toggleSave,
  createRecommendation
} from '@/services/recommendationService';

export const useRecommendationActions = (
  recommendations: Recommendation[],
  setRecommendations: React.Dispatch<React.SetStateAction<Recommendation[]>>,
  refreshRecommendations: () => Promise<void>
) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like recommendations',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = recommendations.find(r => r.id === id);
      if (!item) return;

      // Optimistic update
      setRecommendations(prev => 
        prev.map(item => {
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
      await toggleLike(id, user.id, !!item.isLiked);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert on failure
      refreshRecommendations();
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
        description: 'Please sign in to save recommendations',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = recommendations.find(r => r.id === id);
      if (!item) return;

      // Optimistic update
      setRecommendations(prev => 
        prev.map(item => {
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
      await toggleSave(id, user.id, !!item.isSaved);
    } catch (err) {
      console.error('Error toggling save:', err);
      // Revert on failure
      refreshRecommendations();
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Add recommendation
  const addRecommendation = async (recommendation: Omit<Recommendation, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'likes' | 'isLiked' | 'isSaved'>) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add recommendations',
        variant: 'destructive'
      });
      return null;
    }

    try {
      const newRecommendation = await createRecommendation({
        ...recommendation,
        user_id: user.id,
      });
      
      // Refresh the list
      refreshRecommendations();
      
      toast({
        title: 'Success',
        description: 'Recommendation has been added successfully'
      });
      
      return newRecommendation;
    } catch (err) {
      console.error('Error adding recommendation:', err);
      toast({
        title: 'Error',
        description: 'Failed to add recommendation. Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    handleLike,
    handleSave,
    addRecommendation
  };
};
