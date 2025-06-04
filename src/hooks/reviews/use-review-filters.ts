
import { useState, useMemo } from 'react';
import { Review } from '@/services/reviewService';

export const useReviewFilters = (reviews: Review[]) => {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'highestRated' | 'mostLiked'>('latest');

  // Extract unique categories from reviews
  const categories = useMemo(() => {
    return [...new Set(reviews.map(item => item.category))];
  }, [reviews]);

  // Filter and sort reviews
  const filteredReviews = useMemo(() => {
    return reviews
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
  }, [reviews, activeFilter, sortBy]);

  const clearFilters = () => {
    setActiveFilter(null);
    setSortBy('latest');
  };

  return {
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    filteredReviews,
    categories,
    clearFilters
  };
};
