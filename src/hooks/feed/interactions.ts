import { toggleLike as togglePostLike, toggleSave as togglePostSave } from '@/services/postService';
import { isItemPost } from './api/utils';
import type { CombinedFeedItem } from './types';
import { useState } from 'react';

// Toggle like for a feed item (posts only — the legacy recommendations layer is frozen)
export const toggleFeedItemLike = async (
  item: CombinedFeedItem,
  userId: string
): Promise<boolean> => {
  try {
    if (!isItemPost(item)) {
      console.error('Like attempted on unsupported item type');
      return false;
    }
    return togglePostLike(item.id, userId);
  } catch (error) {
    console.error('Error toggling like for feed item:', error);
    throw error;
  }
};

// Toggle save for feed item — only posts support saving
export const toggleFeedItemSave = async (
  item: CombinedFeedItem,
  userId: string
): Promise<boolean> => {
  if (!isItemPost(item)) {
    console.error('Save attempted on unsupported item type:', (item as any).type);
    return false;
  }
  return togglePostSave(item.id, userId);
};

// Create a hook for interactions that can be used in components
export const useInteractions = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const handleLike = async (id: string, userId: string, itemType: 'post') => {
    setIsLoading(true);
    setError(null);
    try {
      return await togglePostLike(id, userId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to toggle like'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (id: string, userId: string, itemType: 'post') => {
    setIsLoading(true);
    setError(null);
    try {
      return await togglePostSave(id, userId);
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
