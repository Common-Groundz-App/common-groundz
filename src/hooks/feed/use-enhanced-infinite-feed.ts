import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FeedVisibility, CombinedFeedItem } from './types';
import { fetchForYouFeed, fetchFollowingFeed } from './api/feed';
import { toggleFeedItemLike, toggleFeedItemSave } from './interactions';
import { useCallback, useEffect } from 'react';
import { realtimeService } from '@/services/realtimeService';
import { cacheService } from '@/services/cacheService';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

const ITEMS_PER_PAGE = 10;

export const useEnhancedInfiniteFeed = (feedType: FeedVisibility) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { startRender, endRender } = usePerformanceMonitor(`EnhancedInfiniteFeed-${feedType}`);

  const cacheKey = `feed-${feedType}-${user?.id}`;

  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['enhanced-infinite-feed', feedType, user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      startRender();
      
      // Try cache first for initial load
      if (pageParam === 0) {
        const cachedData = cacheService.get(cacheKey);
        if (cachedData) {
          console.log('Using cached feed data');
          endRender();
          return cachedData;
        }
      }

      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      const result = await fetchFunction({
        userId: user?.id || '',
        page: pageParam,
        itemsPerPage: ITEMS_PER_PAGE
      });

      // Cache the result for 2 minutes
      if (pageParam === 0) {
        cacheService.set(cacheKey, result, 2 * 60 * 1000);
      }

      endRender();
      return result;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  const allItems: CombinedFeedItem[] = data?.pages.flatMap(page => page.items) || [];

  // Enhanced real-time updates
  useEffect(() => {
    if (!user) return;

    const subscriptions: string[] = [];

    // Subscribe to new posts with real-time updates
    const postsChannel = realtimeService.subscribeToTable(
      'posts',
      {
        onInsert: (newPost) => {
          console.log('New post received via realtime:', newPost);
          // Invalidate and refresh feed
          queryClient.invalidateQueries({
            queryKey: ['enhanced-infinite-feed', feedType, user.id]
          });
          // Clear cache to force fresh data
          cacheService.delete(cacheKey);
        },
        onUpdate: (updatedPost) => {
          console.log('Post updated via realtime:', updatedPost);
          // Update specific item in cache
          queryClient.setQueryData(['enhanced-infinite-feed', feedType, user.id], (oldData: any) => {
            if (!oldData) return oldData;
            
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                items: page.items.map((item: any) => {
                  if (item.id === updatedPost.id && item.type === 'post') {
                    return { ...item, ...updatedPost };
                  }
                  return item;
                })
              }))
            };
          });
        }
      }
    );
    subscriptions.push(postsChannel);

    // Subscribe to new recommendations
    const recsChannel = realtimeService.subscribeToTable(
      'recommendations',
      {
        onInsert: (newRec) => {
          console.log('New recommendation received via realtime:', newRec);
          queryClient.invalidateQueries({
            queryKey: ['enhanced-infinite-feed', feedType, user.id]
          });
          cacheService.delete(cacheKey);
        },
        onUpdate: (updatedRec) => {
          console.log('Recommendation updated via realtime:', updatedRec);
          queryClient.setQueryData(['enhanced-infinite-feed', feedType, user.id], (oldData: any) => {
            if (!oldData) return oldData;
            
            return {
              ...oldData,
              pages: oldData.pages.map((page: any) => ({
                ...page,
                items: page.items.map((item: any) => {
                  if (item.id === updatedRec.id && item.type === 'recommendation') {
                    return { ...item, ...updatedRec };
                  }
                  return item;
                })
              }))
            };
          });
        }
      }
    );
    subscriptions.push(recsChannel);

    // Subscribe to follow updates for following feed
    if (feedType === 'following') {
      const followsChannel = realtimeService.subscribeToTable(
        'follows',
        {
          onInsert: (newFollow) => {
            if (newFollow.follower_id === user.id) {
              console.log('New follow detected, refreshing following feed');
              queryClient.invalidateQueries({
                queryKey: ['enhanced-infinite-feed', 'following', user.id]
              });
              cacheService.delete(`feed-following-${user.id}`);
            }
          }
        }
      );
      subscriptions.push(followsChannel);
    }

    return () => {
      subscriptions.forEach(sub => realtimeService.unsubscribe(sub));
    };
  }, [user, feedType, queryClient, cacheKey]);

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

      // Optimistic update with immediate UI feedback
      queryClient.setQueryData(['enhanced-infinite-feed', feedType, user.id], (oldData: any) => {
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

      // Clear cache to ensure fresh data on next load
      cacheService.delete(cacheKey);

      await toggleFeedItemLike(item, user.id);
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like status',
        variant: 'destructive'
      });
      
      // Revert optimistic update and refresh
      queryClient.invalidateQueries({
        queryKey: ['enhanced-infinite-feed', feedType, user.id]
      });
    }
  }, [user, allItems, feedType, queryClient, toast, cacheKey]);

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
      queryClient.setQueryData(['enhanced-infinite-feed', feedType, user.id], (oldData: any) => {
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

      cacheService.delete(cacheKey);
      await toggleFeedItemSave(item, user.id);
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: 'Error',
        description: 'Failed to update save status',
        variant: 'destructive'
      });
      
      queryClient.invalidateQueries({
        queryKey: ['enhanced-infinite-feed', feedType, user.id]
      });
    }
  }, [user, allItems, feedType, queryClient, toast, cacheKey]);

  const handleDelete = useCallback((id: string) => {
    queryClient.setQueryData(['enhanced-infinite-feed', feedType, user?.id], (oldData: any) => {
      if (!oldData) return oldData;
      
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          items: page.items.filter((item: any) => item.id !== id)
        }))
      };
    });
    
    cacheService.delete(cacheKey);
  }, [feedType, user?.id, queryClient, cacheKey]);

  const refreshFeed = useCallback(async () => {
    // Clear cache before refreshing
    cacheService.delete(cacheKey);
    await refetch();
  }, [refetch, cacheKey]);

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
