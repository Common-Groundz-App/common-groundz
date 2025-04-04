
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, ChevronDown, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RecommendationFiltersProps {
  isOwnProfile: boolean;
  activeFilter: string | null;
  sortBy: 'latest' | 'highestRated' | 'mostLiked';
  categories: string[];
  onFilterChange: (category: string) => void;
  onSortChange: (sort: 'latest' | 'highestRated' | 'mostLiked') => void;
  onClearFilters: () => void;
  onAddNew: () => void;
}

export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    food: 'Food',
    movie: 'Movie',
    product: 'Product',
    book: 'Book',
    place: 'Place'
  };
  return labels[category] || category;
};

const RecommendationFilters = ({
  isOwnProfile,
  activeFilter,
  sortBy,
  categories,
  onFilterChange,
  onSortChange,
  onClearFilters,
  onAddNew
}: RecommendationFiltersProps) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold">
        {isOwnProfile ? 'My Recommendations' : 'Recommendations'}
      </h2>
      
      <div className="flex items-center gap-2">
        {isOwnProfile && (
          <Button 
            onClick={onAddNew}
            size="sm" 
            className="bg-brand-orange hover:bg-brand-orange/90 text-white"
          >
            <Plus size={16} className="mr-1" /> Add New
          </Button>
        )}
        
        {activeFilter && (
          <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
            {getCategoryLabel(activeFilter)}
            <button 
              onClick={onClearFilters}
              className="ml-1 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </Badge>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Filter size={14} />
              Filter
              <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem 
                className="text-sm font-medium text-gray-500 py-1.5"
                disabled
              >
                Categories
              </DropdownMenuItem>
              {categories.map(category => (
                <DropdownMenuItem 
                  key={category}
                  onClick={() => onFilterChange(category)}
                  className={cn(
                    "cursor-pointer",
                    activeFilter === category ? "bg-gray-100" : ""
                  )}
                >
                  {getCategoryLabel(category)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem 
                className="text-sm font-medium text-gray-500 py-1.5 mt-2"
                disabled
              >
                Sort By
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('latest')}
                className={cn("cursor-pointer", sortBy === 'latest' ? "bg-gray-100" : "")}
              >
                Latest
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('highestRated')}
                className={cn("cursor-pointer", sortBy === 'highestRated' ? "bg-gray-100" : "")}
              >
                Highest Rated
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('mostLiked')}
                className={cn("cursor-pointer", sortBy === 'mostLiked' ? "bg-gray-100" : "")}
              >
                Most Liked
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default RecommendationFilters;
