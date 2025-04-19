
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FeedVisibility } from './types';
import { fetchForYouFeed, fetchFollowingFeed } from './api/feed';

const ITEMS_PER_PAGE = 10;

export const useFeedOperations = (
  feedType: FeedVisibility,
  {
    onSuccess,
    onError,
    onLoadingChange
  }: {
    onSuccess: (data: any, hasMore: boolean, page: number, reset: boolean) => void;
    onError: (error: Error) => void;
    onLoadingChange: (isLoading: boolean, isLoadingMore: boolean) => void;
  }
) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchFeed = useCallback(async (page: number = 0, reset: boolean = false) => {
    if (!user) {
      console.log("No user found in useFeedOperations");
      const error = new Error('User not authenticated');
      onError(error);
      return;
    }

    try {
      console.log(`Fetching ${feedType} feed for page ${page}`);
      onLoadingChange(!reset, !!reset);
      
      const fetchFunction = feedType === 'for_you' ? fetchForYouFeed : fetchFollowingFeed;
      const { items, hasMore } = await fetchFunction({ 
        userId: user.id, 
        page,
        itemsPerPage: ITEMS_PER_PAGE
      });
      
      console.log(`Received ${items.length} items for ${feedType} feed`);
      onSuccess(items, hasMore, page, reset);
    } catch (error) {
      console.error(`Error fetching ${feedType} feed:`, error);
      const feedError = error instanceof Error ? error : new Error('Failed to fetch feed');
      onError(feedError);
      
      toast({
        title: 'Feed Error',
        description: feedError.message,
        variant: 'destructive'
      });
    }
  }, [user, feedType, onSuccess, onError, onLoadingChange, toast]);

  return {
    fetchFeed
  };
};
