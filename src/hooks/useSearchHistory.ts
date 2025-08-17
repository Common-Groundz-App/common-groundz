import { useLocalStorage } from './useLocalStorage';
import { useCallback } from 'react';

interface SearchHistoryItem {
  query: string;
  hashtag: string;
  timestamp: number;
}

export function useSearchHistory(hashtag: string) {
  const [searchHistory, setSearchHistory] = useLocalStorage<SearchHistoryItem[]>(`search-history-${hashtag}`, []);

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return;

    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.query !== query);
      const newItem: SearchHistoryItem = {
        query: query.trim(),
        hashtag,
        timestamp: Date.now()
      };
      return [newItem, ...filtered].slice(0, 10); // Keep only last 10 searches
    });
  }, [setSearchHistory, hashtag]);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, [setSearchHistory]);

  const removeFromHistory = useCallback((query: string) => {
    setSearchHistory(prev => prev.filter(item => item.query !== query));
  }, [setSearchHistory]);

  return {
    searchHistory,
    addToHistory,
    clearHistory,
    removeFromHistory
  };
}