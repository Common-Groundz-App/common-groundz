
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
  const [page, setPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Use React Query to fetch the feed data with proper key management
  const { 
    data: feedData,
    error: feedError,
    isLoading: isFeedLoading,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['feed', feedType, user?.id, page],
    queryFn: async () => {
      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      return await fetchFunction({ 
        userId: user?.id || '', 
        page,
        itemsPerPage: ITEMS_PER_PAGE
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes (was cacheTime)
  });

  // Combine items from all pages
  const allItems = feedData?.items || [];
  const hasMore = feedData?.hasMore || false;

  // Handle errors
  useEffect(() => {
    if (feedError) {
      console.error('Feed error:', feedError);
      toast({
        title: 'Feed Error',
        description: feedError instanceof Error ? feedError.message : 'Failed to load feed items',
        variant: 'destructive'
      });
    }
  }, [feedError, toast]);

  // Load more data
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isFeedLoading) return;
    
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      const newData = await fetchFunction({ 
        userId: user?.id || '', 
        page: nextPage,
        itemsPerPage: ITEMS_PER_PAGE
      });
      
      // Update cache with combined data
      queryClient.setQueryData(['feed', feedType, user?.id, nextPage], newData);
      setPage(nextPage);
    } catch (error) {
      console.error('Error loading more:', error);
      toast({
        title: 'Error',
        description: 'Failed to load more items',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, isFeedLoading, page, feedType, user?.id, queryClient, toast]);

  // Refresh feed - simplified and more reliable
  const refreshFeed = useCallback(async () => {
    try {
      // Reset to first page
      setPage(0);
      
      // Invalidate all pages of this feed
      await queryClient.invalidateQueries({
        queryKey: ['feed', feedType, user?.id]
      });

      // Force refetch with timeout fallback
      const refreshPromise = refetch();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Refresh timeout')), 10000)
      );

      await Promise.race([refreshPromise, timeoutPromise]);
    } catch (error) {
      console.error('Error refreshing feed:', error);
      toast({
        title: 'Refresh Error',
        description: 'Failed to refresh feed. Please try again.',
        variant: 'destructive'
      });
    }
  }, [queryClient, feedType, user?.id, refetch, toast]);

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
      const item = allItems.find(r => r.id === id);
      if (!item) return;
      
      const itemType = isItemPost(item) ? 'post' : 'recommendation';

      // Optimistically update cache
      queryClient.setQueryData(['feed', feedType, user?.id, page], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((item: any) => {
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
        };
      });

      await toggleFeedItemLike(item, user.id);
    } catch (err) {
      console.error('Error toggling like:', err);
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      queryClient.invalidateQueries({
        queryKey: ['feed', feedType, user?.id, page]
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

    try {
      const item = allItems.find(r => r.id === id);
      if (!item) return;
      
      const itemType = isItemPost(item) ? 'post' : 'recommendation';

      // Optimistically update cache
      queryClient.setQueryData(['feed', feedType, user?.id, page], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((item: any) => {
            if (item.id === id) {
              return {
                ...item,
                is_saved: !item.is_saved
              };
            }
            return item;
          })
        };
      });

      await toggleFeedItemSave(item, user.id);
    } catch (err) {
      console.error('Error toggling save:', err);
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update on error
      queryClient.invalidateQueries({
        queryKey: ['feed', feedType, user?.id, page]
      });
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    // Update cache to remove deleted item
    queryClient.setQueryData(['feed', feedType, user?.id, page], (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        items: oldData.items.filter((item: any) => item.id !== id)
      };
    });
  }, [queryClient, feedType, user?.id, page]);

  // Global refresh event listener
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
    items: allItems,
    isLoading: isFeedLoading || isRefetching,
    error: feedError,
    hasMore,
    isLoadingMore,
    loadMore,
    refreshFeed,
    handleLike,
    handleSave,
    handleDelete
  };
};
