
import { useState, useEffect, useMemo } from 'react';
import { Recommendation } from '@/services/recommendationService';

export const useRecommendationFilters = (recommendations: Recommendation[]) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'highestRated' | 'mostLiked'>('latest');

  // Extract unique categories from recommendations
  const categories = useMemo(() => {
    return [...new Set(recommendations.map(item => item.category))];
  }, [recommendations]);

  // Filter and sort recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations
      .filter(item => !activeFilter || item.category === activeFilter)
      .sort((a, b) => {
        if (sortBy === 'latest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else if (sortBy === 'highestRated') {
          return b.rating - a.rating;
        } else if (sortBy === 'mostLiked') {
          return (b.likes || 0) - (a.likes || 0);
        }
        return 0;
      });
  }, [recommendations, activeFilter, sortBy]);

  const clearFilters = () => {
    setActiveFilter(null);
    setSortBy('latest');
  };

  return {
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    filteredRecommendations,
    categories,
    clearFilters
  };
};
