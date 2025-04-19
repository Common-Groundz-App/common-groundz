import { supabase } from '@/integrations/supabase/client';
import { toggleLike as toggleRecommendationLike } from '@/services/recommendationService';
import { toggleSave as toggleRecommendationSave } from '@/services/recommendation/interactionOperations';
import { toggleLike as togglePostLike, toggleSave as togglePostSave } from '@/services/postService';
import { isItemPost } from './api/utils';
import type { CombinedFeedItem } from './types';

// Toggle like for feed item (post or recommendation)
export const toggleFeedItemLike = async (
  item: CombinedFeedItem, 
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
    console.error('Error toggling like for feed item:', error);
    throw error;
  }
};

// Toggle save for feed item (post or recommendation)
export const toggleFeedItemSave = async (
  item: CombinedFeedItem, 
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
    console.error('Error toggling save for feed item:', error);
    throw error;
  }
};
