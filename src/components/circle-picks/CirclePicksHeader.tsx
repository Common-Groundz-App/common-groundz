
import React from 'react';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CirclePicksHeaderProps {
  categories: { value: string; label: string }[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortBy: 'recent' | 'most_liked' | 'highest_rated';
  onSortChange: (sort: 'recent' | 'most_liked' | 'highest_rated') => void;
}

export const CirclePicksHeader = ({
  categories,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange
}: CirclePicksHeaderProps) => {
  return (
    <div className="py-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Circle Picks</h1>
        <p className="text-muted-foreground mt-2">
          Discover recommendations and reviews from people you follow
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => onCategoryChange(category.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === category.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="most_liked">Most Liked</SelectItem>
            <SelectItem value="highest_rated">Highest Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
