
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FeedVisibility, CombinedFeedItem } from './types';
import { fetchForYouFeed, fetchFollowingFeed } from './api/feed';
import { toggleFeedItemLike, toggleFeedItemSave } from './interactions';
import { isItemPost } from './api/utils';
import { useCallback, useEffect } from 'react';
import { realtimeService } from '@/services/realtimeService';

const ITEMS_PER_PAGE = 10;

export const useInfiniteFeed = (feedType: FeedVisibility) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use infinite query for seamless pagination
  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['infinite-feed', feedType, user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      return await fetchFunction({
        userId: user?.id || '',
        page: pageParam,
        itemsPerPage: ITEMS_PER_PAGE
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  // Flatten all pages into single array
  const allItems: CombinedFeedItem[] = data?.pages.flatMap(page => page.items) || [];

  // Real-time updates for feed items
  useEffect(() => {
    if (!user) return;

    // Subscribe to new posts
    const postsChannel = realtimeService.subscribeToTable(
      'posts',
      {
        onInsert: (newPost) => {
          // Invalidate query to show new posts
          queryClient.invalidateQueries({
            queryKey: ['infinite-feed', feedType, user.id]
          });
        }
      }
    );

    // Subscribe to new recommendations
    const recsChannel = realtimeService.subscribeToTable(
      'recommendations',
      {
        onInsert: (newRec) => {
          queryClient.invalidateQueries({
            queryKey: ['infinite-feed', feedType, user.id]
          });
        }
      }
    );

    return () => {
      realtimeService.unsubscribe(postsChannel);
      realtimeService.unsubscribe(recsChannel);
    };
  }, [user, feedType, queryClient]);

  const handleLike = useCallback(async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like content',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = allItems.find(item => item.id === id);
      if (!item) return;

      // Optimistic update
      queryClient.setQueryData(['infinite-feed', feedType, user.id], (oldData: any) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) => {
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
          }))
        };
      });

      await toggleFeedItemLike(item, user.id);
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like status',
        variant: 'destructive'
      });
      
      // Revert optimistic update
      queryClient.invalidateQueries({
        queryKey: ['infinite-feed', feedType, user.id]
      });
    }
  }, [user, allItems, feedType, queryClient, toast]);

  const handleSave = useCallback(async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save content',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = allItems.find(item => item.id === id);
      if (!item) return;

      // Optimistic update
      queryClient.setQueryData(['infinite-feed', feedType, user.id], (oldData: any) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: any) => {
              if (item.id === id) {
                return {
                  ...item,
                  is_saved: !item.is_saved
                };
              }
              return item;
            })
          }))
        };
      });

      await toggleFeedItemSave(item, user.id);
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: 'Error',
        description: 'Failed to update save status',
        variant: 'destructive'
      });
      
      // Revert optimistic update
      queryClient.invalidateQueries({
        queryKey: ['infinite-feed', feedType, user.id]
      });
    }
  }, [user, allItems, feedType, queryClient, toast]);

  const handleDelete = useCallback((id: string) => {
    queryClient.setQueryData(['infinite-feed', feedType, user?.id], (oldData: any) => {
      if (!oldData) return oldData;
      
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          items: page.items.filter((item: any) => item.id !== id)
        }))
      };
    });
  }, [feedType, user?.id, queryClient]);

  const refreshFeed = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    items: allItems,
    isLoading,
    error,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore: fetchNextPage,
    refreshFeed,
    handleLike,
    handleSave,
    handleDelete
  };
};
