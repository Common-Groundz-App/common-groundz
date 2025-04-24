import { supabase } from '@/integrations/supabase/client';
import { toggleLike as toggleRecommendationLike } from '@/services/recommendationService';
import { toggleSave as toggleRecommendationSave } from '@/services/recommendation/interactionOperations';
import { toggleLike as togglePostLike, toggleSave as togglePostSave } from '@/services/postService';
import { isItemPost } from './api/utils';
import type { CombinedHomeItem } from './types';
import { useState } from 'react';

// Toggle like for home item (post or recommendation)
export const toggleHomeItemLike = async (
  item: CombinedHomeItem, 
  userId: string
): Promise<boolean> => {
  try {
    // If the item is a post, use post like toggling
    if (isItemPost(item)) {
      return togglePostLike(item.id, userId);
    }
    
    // Otherwise use recommendation like toggling
    return toggleRecommendationLike(item.id, userId, !!item.is_liked);
  } catch (error) {
    console.error('Error toggling like for home item:', error);
    throw error;
  }
};

// Toggle save for home item (post or recommendation)
export const toggleHomeItemSave = async (
  item: CombinedHomeItem, 
  userId: string
): Promise<boolean> => {
  try {
    // If the item is a post, use post save toggling
    if (isItemPost(item)) {
      return togglePostSave(item.id, userId);
    }
    
    // Otherwise use recommendation save toggling
    return toggleRecommendationSave(item.id, userId, !!item.is_saved);
  } catch (error) {
    console.error('Error toggling save for home item:', error);
    throw error;
  }
};

// Create a hook for interactions that can be used in components
export const useInteractions = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const handleLike = async (id: string, userId: string, itemType: 'post' | 'recommendation') => {
    setIsLoading(true);
    setError(null);
    try {
      if (itemType === 'post') {
        return await togglePostLike(id, userId);
      } else {
        // For recommendations, we need to determine the current like state
        const { data } = await supabase
          .from('recommendation_likes')
          .select('id')
          .eq('recommendation_id', id)
          .eq('user_id', userId)
          .single();
        
        const isLiked = !!data;
        return await toggleRecommendationLike(id, userId, isLiked);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to toggle like'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (id: string, userId: string, itemType: 'post' | 'recommendation') => {
    setIsLoading(true);
    setError(null);
    try {
      if (itemType === 'post') {
        return await togglePostSave(id, userId);
      } else {
        // For recommendations, we need to determine the current save state
        const { data } = await supabase
          .from('recommendation_saves')
          .select('id')
          .eq('recommendation_id', id)
          .eq('user_id', userId)
          .single();
        
        const isSaved = !!data;
        return await toggleRecommendationSave(id, userId, isSaved);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to toggle save'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleLike,
    handleSave,
    isLoading,
    error
  };
};
