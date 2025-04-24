
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { HomeVisibility, HomeState } from './types';
import { fetchForYouHome, fetchFollowingHome } from './api/home';
import { toggleHomeItemLike, toggleHomeItemSave, useInteractions } from './interactions';
import { isItemPost } from './api/utils';

const ITEMS_PER_PAGE = 10;

export const useHome = (homeType: HomeVisibility) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<HomeState>({
    items: [],
    isLoading: true,
    error: null,
    hasMore: false,
    page: 0,
    isLoadingMore: false
  });

  const fetchHome = useCallback(async (page: number = 0, reset: boolean = false) => {
    if (!user) {
      console.log("No user found in useHome");
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
      console.log(`Fetching ${homeType} home for page ${page}`);
      setState(prev => ({
        ...prev,
        isLoading: !prev.items.length || reset,
        isLoadingMore: !!prev.items.length && !reset
      }));
      
      const fetchFunction = homeType === 'for_you' ? fetchForYouHome : fetchFollowingHome;
      const { items, hasMore } = await fetchFunction({ 
        userId: user.id, 
        page,
        itemsPerPage: ITEMS_PER_PAGE
      });
      
      console.log(`Received ${items.length} items for ${homeType} home`);
      
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
      console.error(`Error fetching ${homeType} home:`, error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false,
        error: error instanceof Error ? error : new Error('Failed to fetch home')
      }));
      
      toast({
        title: 'Home Error',
        description: error instanceof Error ? error.message : 'Failed to load home items',
        variant: 'destructive'
      });
    }
  }, [user, homeType, toast]);

  useEffect(() => {
    if (user) {
      console.log(`Setting up initial home load for ${homeType}`);
      fetchHome(0, true);
    }
  }, [fetchHome, user]);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    fetchHome(state.page + 1);
  }, [state.isLoadingMore, state.hasMore, state.page, fetchHome]);

  const refreshHome = useCallback(() => {
    setState(prev => ({ ...prev, isLoading: true }));
    fetchHome(0, true);
  }, [fetchHome]);

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

      await toggleHomeItemLike(item, user.id);
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

      await toggleHomeItemSave(item, user.id);
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
      console.log(`Refreshing ${homeType} home due to global event`);
      refreshHome();
    };
    
    window.addEventListener('refresh-home', handleGlobalRefresh);
    
    return () => {
      window.removeEventListener('refresh-home', handleGlobalRefresh);
    };
  }, [refreshHome, homeType]);

  return {
    ...state,
    loadMore,
    refreshHome,
    handleLike,
    handleSave,
    handleDelete
  };
};
