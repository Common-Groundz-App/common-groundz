
import { useState, useMemo } from 'react';
import { Recommendation } from '@/services/recommendation/types';

type FilterableItem = {
  id: string;
  title: string;
  category: string;
  rating: number;
  created_at: string;
};

export const useRecommendationFilters = <T extends FilterableItem>(items: T[]) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');

  // Extract unique categories from the items
  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    items.forEach(item => {
      if (item.category) {
        uniqueCategories.add(item.category);
      }
    });
    return Array.from(uniqueCategories);
  }, [items]);

  // Apply filtering and sorting
  const filteredRecommendations = useMemo(() => {
    // Start with all items
    let filtered = [...items];

    // Apply category filter if active
    if (activeFilter) {
      filtered = filtered.filter(item => item.category === activeFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'highest':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        filtered.sort((a, b) => a.rating - b.rating);
        break;
    }

    return filtered;
  }, [items, activeFilter, sortBy]);

  const clearFilters = () => {
    setActiveFilter(null);
    setSortBy('newest');
  };

  return {
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    filteredRecommendations,
    categories,
    clearFilters,
  };
};
