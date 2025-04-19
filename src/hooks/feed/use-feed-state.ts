
import { useState } from 'react';
import { FeedState, CombinedFeedItem } from './types';

interface UseFeedStateProps {
  initialState?: Partial<FeedState>;
}

export const useFeedState = ({ initialState = {} }: UseFeedStateProps = {}) => {
  const [state, setState] = useState<FeedState>({
    items: [],
    isLoading: true,
    error: null,
    hasMore: false,
    page: 0,
    isLoadingMore: false,
    ...initialState
  });

  const updateItems = (items: CombinedFeedItem[], reset: boolean = false) => {
    setState(prev => ({
      ...prev,
      items: reset ? items : [...prev.items, ...items]
    }));
  };

  const setLoading = (isLoading: boolean, isLoadingMore: boolean = false) => {
    setState(prev => ({
      ...prev,
      isLoading,
      isLoadingMore,
      error: null
    }));
  };

  const setError = (error: Error) => {
    setState(prev => ({
      ...prev,
      isLoading: false,
      isLoadingMore: false,
      error
    }));
  };

  const updatePagination = (hasMore: boolean, page: number) => {
    setState(prev => ({
      ...prev,
      hasMore,
      page
    }));
  };

  const updateItemById = (id: string, updates: Partial<CombinedFeedItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  };

  const removeItemById = (id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  return {
    state,
    updateItems,
    setLoading,
    setError,
    updatePagination,
    updateItemById,
    removeItemById
  };
};
