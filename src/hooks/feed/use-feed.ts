
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FeedVisibility, FeedState } from './types';
import { fetchForYouFeed, fetchFollowingFeed } from './api/feed';
import { useInteractions } from './interactions';
import { isItemPost } from './api/utils';

const ITEMS_PER_PAGE = 10;

export const useFeed = (feedType: FeedVisibility) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<FeedState>({
    items: [],
    isLoading: true,
    error: null,
    hasMore: false,
    page: 0,
    isLoadingMore: false
  });

  const fetchFeed = useCallback(async (page: number = 0, reset: boolean = false) => {
    if (!user) {
      console.log("No user found in useFeed");
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: new Error('User not authenticated'),
        items: [],
        hasMore: false,
        isLoadingMore: false
      }));
      return;
    }

    try {
      console.log(`Fetching ${feedType} feed for page ${page}`);
      setState(prev => ({
        ...prev,
        isLoading: !prev.items.length || reset,
        isLoadingMore: !!prev.items.length && !reset
      }));
      
      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      const { items, hasMore } = await fetchFunction({ 
        userId: user.id, 
        page,
        itemsPerPage: ITEMS_PER_PAGE
      });
      
      console.log(`Received ${items.length} items for ${feedType} feed`);
      
      setState(prev => ({
        ...prev,
        items: reset ? items : [...prev.items, ...items],
        hasMore,
        page,
        isLoading: false,
        isLoadingMore: false,
        error: null
      }));
    } catch (error) {
      console.error(`Error fetching ${feedType} feed:`, error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false,
        error: error instanceof Error ? error : new Error('Failed to fetch feed')
      }));
      
      toast({
        title: 'Feed Error',
        description: error instanceof Error ? error.message : 'Failed to load feed items',
        variant: 'destructive'
      });
    }
  }, [user, feedType, toast]);

  useEffect(() => {
    if (user) {
      console.log(`Setting up initial feed load for ${feedType}`);
      fetchFeed(0, true);
    }
  }, [fetchFeed, user]);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    fetchFeed(state.page + 1);
  }, [state.isLoadingMore, state.hasMore, state.page, fetchFeed]);

  const refreshFeed = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: true }));
    fetchFeed(0, true);
  }, [fetchFeed]);

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

    try {
      const item = state.items.find(r => r.id === id);
      if (!item) return;
      
      const itemType = isItemPost(item) ? 'post' : 'recommendation';

      // Optimistically update UI
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
            const isLiked = !item.is_liked;
            return {
              ...item,
              is_liked: isLiked,
              likes: (item.likes || 0) + (isLiked ? 1 : -1)
            };
          }
          return item;
        })
      }));

      await interactionLike(id, user.id, itemType);
    } catch (err) {
      console.error('Error toggling like:', err);
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
            const isLiked = !item.is_liked;
            return {
              ...item,
              is_liked: !isLiked,
              likes: (item.likes || 0) + (isLiked ? -1 : 1)
            };
          }
          return item;
        })
      }));
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

    try {
      const item = state.items.find(r => r.id === id);
      if (!item) return;
      
      const itemType = isItemPost(item) ? 'post' : 'recommendation';

      // Optimistically update UI
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
            return {
              ...item,
              is_saved: !item.is_saved
            };
          }
          return item;
        })
      }));

      await interactionSave(id, user.id, itemType);
    } catch (err) {
      console.error('Error toggling save:', err);
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      setState(prev => ({
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
            return {
              ...item,
              is_saved: !item.is_saved
            };
          }
          return item;
        })
      }));
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  }, []);

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
