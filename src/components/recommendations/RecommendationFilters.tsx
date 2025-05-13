
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
  sortBy: 'newest' | 'highest' | 'lowest';
  categories: string[];
  onFilterChange: (category: string) => void;
  onSortChange: (sort: 'newest' | 'highest' | 'lowest') => void;
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
                onClick={() => onSortChange('newest')}
                className={cn("cursor-pointer", sortBy === 'newest' ? "bg-gray-100" : "")}
              >
                Latest
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('highest')}
                className={cn("cursor-pointer", sortBy === 'highest' ? "bg-gray-100" : "")}
              >
                Highest Rated
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onSortChange('lowest')}
                className={cn("cursor-pointer", sortBy === 'lowest' ? "bg-gray-100" : "")}
              >
                Lowest Rated
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default RecommendationFilters;
