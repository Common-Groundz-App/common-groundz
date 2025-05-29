
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FeedVisibility, FeedState } from './types';
import { fetchForYouFeed, fetchFollowingFeed } from './api/feed';
import { toggleFeedItemLike, toggleFeedItemSave, useInteractions } from './interactions';
import { isItemPost } from './api/utils';

const ITEMS_PER_PAGE = 10;

export const useFeed = (feedType: FeedVisibility) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [state, setState] = useState<FeedState>({
    items: [],
    isLoading: true,
    error: null,
    hasMore: false,
    page: 0,
    isLoadingMore: false
  });

  // Use React Query to fetch the feed data - removed page from query key
  const { 
    data: feedData,
    error: feedError,
    isLoading: isFeedLoading,
    refetch
  } = useQuery({
    queryKey: ['feed', feedType, user?.id],
    queryFn: async () => {
      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      return await fetchFunction({ 
        userId: user?.id || '', 
        page: state.page,
        itemsPerPage: ITEMS_PER_PAGE
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Update state when data changes
  useEffect(() => {
    if (feedData) {
      setState(prev => ({
        ...prev,
        items: prev.page === 0 ? feedData.items : [...prev.items, ...feedData.items],
        hasMore: feedData.hasMore,
        isLoading: false,
        isLoadingMore: false,
        error: null
      }));
    }
  }, [feedData]);

  // Handle errors
  useEffect(() => {
    if (feedError) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false,
        error: feedError instanceof Error ? feedError : new Error('Failed to fetch feed')
      }));
      
      toast({
        title: 'Feed Error',
        description: feedError instanceof Error ? feedError.message : 'Failed to load feed items',
        variant: 'destructive'
      });
    }
  }, [feedError, toast]);

  // Load more data
  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    
    setState(prev => ({ 
      ...prev, 
      page: prev.page + 1,
      isLoadingMore: true 
    }));
  }, [state.isLoadingMore, state.hasMore]);

  // Refresh feed - fixed to properly reset state and invalidate cache
  const refreshFeed = useCallback(async () => {
    // Reset state to initial values
    setState(prev => ({ 
      ...prev, 
      page: 0,
      items: [],
      isLoading: true,
      error: null
    }));

    // Invalidate the query cache to force fresh data
    await queryClient.invalidateQueries({
      queryKey: ['feed', feedType, user?.id]
    });

    // Refetch the data
    await refetch();
  }, [queryClient, feedType, user?.id, refetch]);

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

      await toggleFeedItemLike(item, user.id);
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

      await toggleFeedItemSave(item, user.id);
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
    isLoading: state.isLoading || isFeedLoading,
    loadMore,
    refreshFeed,
    handleLike,
    handleSave,
    handleDelete
  };
};
