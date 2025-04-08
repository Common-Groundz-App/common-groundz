
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FeedItem, FeedVisibility, FeedState } from './types';
import { fetchForYouFeed, fetchFollowingFeed } from './api/feed';
import { useInteractions } from './interactions';

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
      console.log("Cannot fetch feed: User not authenticated");
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: new Error('User not authenticated'),
        items: []
      }));
      return;
    }

    try {
      console.log(`Fetching ${feedType} feed, page ${page}, reset: ${reset}`);
      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      const { items, hasMore } = await fetchFunction({ 
        userId: user.id, 
        page,
        itemsPerPage: ITEMS_PER_PAGE
      });
      
      console.log(`${feedType} feed fetch successful:`, {
        itemsCount: items.length,
        hasMore
      });
      
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
    }
  }, [user, feedType]);

  useEffect(() => {
    console.log(`useFeed(${feedType}) mounted, isAuthenticated:`, !!user);
    setState(prev => ({ ...prev, isLoading: true }));
    fetchFeed(0, true);
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    
    setState(prev => ({ ...prev, isLoadingMore: true }));
    fetchFeed(state.page + 1);
  }, [state.isLoadingMore, state.hasMore, state.page, fetchFeed]);

  const refreshFeed = useCallback(() => {
    console.log(`Refreshing ${feedType} feed`);
    setState(prev => ({ ...prev, isLoading: true }));
    fetchFeed(0, true);
  }, [fetchFeed, feedType]);

  const { handleLike: interactionLike, handleSave: interactionSave } = useInteractions();

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
      const item = state.items.find(r => r.id === id);
      if (!item) return;

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

      await interactionLike(id, user.id);
    } catch (err) {
      console.error('Error toggling like:', err);
      
      // Only refresh in case of error, not on successful operation
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      setState(prev => ({
        ...prev,
        items: state.items.map(item => {
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
        description: 'Please sign in to save recommendations',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = state.items.find(r => r.id === id);
      if (!item) return;

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

      await interactionSave(id, user.id);
    } catch (err) {
      console.error('Error toggling save:', err);
      
      // Only show toast and revert on error
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      setState(prev => ({
        ...prev,
        items: state.items.map(item => {
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

  return {
    ...state,
    loadMore,
    refreshFeed,
    handleLike,
    handleSave
  };
};
