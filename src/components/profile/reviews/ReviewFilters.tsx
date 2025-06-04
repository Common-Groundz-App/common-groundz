
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

interface ReviewFiltersProps {
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  sortBy: 'latest' | 'highestRated' | 'mostLiked';
  setSortBy: (sort: 'latest' | 'highestRated' | 'mostLiked') => void;
  categories: string[];
  clearFilters: () => void;
  isOwnProfile: boolean;
}

const ReviewFilters = ({
  activeFilter,
  setActiveFilter,
  sortBy,
  setSortBy,
  categories,
  clearFilters,
  isOwnProfile
}: ReviewFiltersProps) => {
  const hasActiveFilters = activeFilter || sortBy !== 'latest';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {isOwnProfile ? 'My Reviews' : 'Reviews'}
        </h2>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Category Filter */}
          <Select
            value={activeFilter || 'all'}
            onValueChange={(value) => setActiveFilter(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort Filter */}
          <Select
            value={sortBy}
            onValueChange={(value: 'latest' | 'highestRated' | 'mostLiked') => setSortBy(value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="highestRated">Highest Rated</SelectItem>
              <SelectItem value="mostLiked">Most Liked</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      {(activeFilter || sortBy !== 'latest') && (
        <div className="flex flex-wrap gap-2">
          {activeFilter && (
            <Badge variant="secondary" className="gap-1">
              {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setActiveFilter(null)}
              />
            </Badge>
          )}
          {sortBy !== 'latest' && (
            <Badge variant="secondary" className="gap-1">
              {sortBy === 'highestRated' ? 'Highest Rated' : 'Most Liked'}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setSortBy('latest')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewFilters;
