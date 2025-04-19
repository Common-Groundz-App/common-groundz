
import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FeedVisibility } from './types';
import { useInteractions } from './interactions';
import { useFeedState } from './use-feed-state';
import { useFeedOperations } from './use-feed-operations';
import { isItemPost } from './api/utils';

export const useFeed = (feedType: FeedVisibility) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    state,
    updateItems,
    setLoading,
    setError,
    updatePagination,
    updateItemById,
    removeItemById
  } = useFeedState();

  const { fetchFeed } = useFeedOperations(feedType, {
    onSuccess: (items, hasMore, page, reset) => {
      updateItems(items, reset);
      updatePagination(hasMore, page);
      setLoading(false, false);
    },
    onError: setError,
    onLoadingChange: setLoading
  });

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    fetchFeed(state.page + 1);
  }, [state.isLoadingMore, state.hasMore, state.page, fetchFeed]);

  const refreshFeed = useCallback(() => {
    setLoading(true);
    fetchFeed(0, true);
  }, [fetchFeed, setLoading]);

  const { handleLike: interactionLike, handleSave: interactionSave } = useInteractions();

  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like content',
        variant: 'destructive'
      });
      return;
    }

    const item = state.items.find(r => r.id === id);
    if (!item) return;

    // Determine item type - post or recommendation
    const itemType = isItemPost(item) ? 'post' : 'recommendation';

    // Optimistic update
    updateItemById(id, {
      is_liked: !item.is_liked,
      likes: (item.likes || 0) + (!item.is_liked ? 1 : -1)
    });

    try {
      await interactionLike(id, user.id, itemType);
    } catch (err) {
      console.error('Error toggling like:', err);
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      updateItemById(id, {
        is_liked: item.is_liked,
        likes: item.likes
      });
    }
  };

  const handleSave = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save content',
        variant: 'destructive'
      });
      return;
    }

    const item = state.items.find(r => r.id === id);
    if (!item) return;

    // Determine item type - post or recommendation
    const itemType = isItemPost(item) ? 'post' : 'recommendation';

    // Optimistic update
    updateItemById(id, { is_saved: !item.is_saved });

    try {
      await interactionSave(id, user.id, itemType);
    } catch (err) {
      console.error('Error toggling save:', err);
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      updateItemById(id, { is_saved: item.is_saved });
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    removeItemById(id);
  }, [removeItemById]);

  useEffect(() => {
    if (user) {
      console.log(`Setting up initial feed load for ${feedType}`);
      fetchFeed(0, true);
    }
  }, [fetchFeed, user]);

  useEffect(() => {
    const handleGlobalRefresh = () => {
      console.log(`Refreshing ${feedType} feed due to global event`);
      refreshFeed();
    };
    
    window.addEventListener('refresh-feed', handleGlobalRefresh);
    
    return () => {
      window.removeEventListener('refresh-feed', handleGlobalRefresh);
    };
  }, [refreshFeed, feedType]);

  return {
    ...state,
    loadMore,
    refreshFeed,
    handleLike,
    handleSave,
    handleDelete
  };
};
