import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEmailVerification } from '@/hooks/useEmailVerification';
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
  const { canPerformAction, showVerificationRequired } = useEmailVerification();

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like recommendations',
        variant: 'destructive'
      });
      return;
    }

    // Email verification gate (Phase 2 — UI only)
    if (!canPerformAction('canLikeContent')) {
      showVerificationRequired('canLikeContent');
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

      // Server update - note we're passing the current state before the optimistic update
      const newLikeState = await toggleLike(id, user.id, !!item.isLiked);
      
      // If there's a mismatch between our optimistic update and the server response,
      // refresh to get the correct state
      if (newLikeState !== !item.isLiked) {
        console.log("Like state mismatch, refreshing...");
        refreshRecommendations();
      }
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

    // Email verification gate (Phase 2 — UI only)
    if (!canPerformAction('canCreateRecommendations')) {
      showVerificationRequired('canCreateRecommendations');
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
