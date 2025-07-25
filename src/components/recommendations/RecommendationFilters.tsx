
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
  onAddNew?: () => void; // Make optional
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
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-lg lg:text-xl font-semibold">
          {isOwnProfile ? 'My Recommendations' : 'Recommendations'}
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Filter Button - Always on the left */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Filter size={14} />
                <span className="max-[500px]:hidden">Filter</span>
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

          {/* Add New Button - Only render if onAddNew is provided */}
          {isOwnProfile && onAddNew && (
            <Button 
              onClick={onAddNew}
              size="sm" 
              className="bg-brand-orange hover:bg-brand-orange/90 text-white max-[500px]:text-sm max-[500px]:px-2 max-[500px]:h-10 max-[500px]:w-10 max-[500px]:p-0 max-[500px]:rounded-md max-[500px]:text-[18px]"
            >
              <Plus size={18} className="max-[500px]:mr-0 min-[500px]:mr-1" />
              <span className="max-[500px]:hidden">Add New</span>
            </Button>
          )}
        </div>
      </div>
      
      {/* Active Filter Badge */}
      {activeFilter && (
        <div className="mt-2">
          <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 w-fit">
            {getCategoryLabel(activeFilter)}
            <button 
              onClick={onClearFilters}
              className="ml-1 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
};

export default RecommendationFilters;
