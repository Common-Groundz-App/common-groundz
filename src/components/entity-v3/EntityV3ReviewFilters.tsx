
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter, Search, X, Star, CheckCircle, Calendar } from 'lucide-react';

interface FilterOptions {
  rating?: number[];
  verified?: boolean;
  hasTimeline?: boolean;
  dateRange?: string;
  categories?: string[];
}

interface EntityV3ReviewFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableCategories: string[];
  totalResults: number;
  onClearFilters: () => void;
}

export const EntityV3ReviewFilters: React.FC<EntityV3ReviewFiltersProps> = ({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  availableCategories,
  totalResults,
  onClearFilters
}) => {
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleRatingFilter = (rating: number) => {
    const currentRatings = filters.rating || [];
    const newRatings = currentRatings.includes(rating)
      ? currentRatings.filter(r => r !== rating)
      : [...currentRatings, rating];
    
    onFiltersChange({
      ...filters,
      rating: newRatings.length > 0 ? newRatings : undefined
    });
  };

  const handleCategoryFilter = (category: string) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    onFiltersChange({
      ...filters,
      categories: newCategories.length > 0 ? newCategories : undefined
    });
  };

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < rating 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-4">
      {/* Search and Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Most Recent</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
              <SelectItem value="helpful">Most Helpful</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end">
              <DropdownMenuLabel>Filter Reviews</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Rating
                </DropdownMenuLabel>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <DropdownMenuCheckboxItem
                    key={rating}
                    checked={filters.rating?.includes(rating) || false}
                    onCheckedChange={() => handleRatingFilter(rating)}
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center gap-1">
                      {renderStars(rating)}
                    </div>
                    <span>{rating} Star{rating !== 1 ? 's' : ''}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Review Type
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={filters.verified || false}
                  onCheckedChange={(checked) => 
                    onFiltersChange({ ...filters, verified: checked || undefined })
                  }
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Verified Reviews
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.hasTimeline || false}
                  onCheckedChange={(checked) => 
                    onFiltersChange({ ...filters, hasTimeline: checked || undefined })
                  }
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Timeline Reviews
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>

              {availableCategories.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                      Categories
                    </DropdownMenuLabel>
                    {availableCategories.map((category) => (
                      <DropdownMenuCheckboxItem
                        key={category}
                        checked={filters.categories?.includes(category) || false}
                        onCheckedChange={() => handleCategoryFilter(category)}
                      >
                        {category}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </>
              )}

              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearFilters}
                    className="w-full"
                  >
                    Clear All Filters
                  </Button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {filters.rating?.map((rating) => (
            <Badge key={rating} variant="secondary" className="flex items-center gap-1">
              {rating} Star{rating !== 1 ? 's' : ''}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleRatingFilter(rating)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {filters.verified && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Verified Only
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onFiltersChange({ ...filters, verified: undefined })}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.hasTimeline && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Timeline Reviews
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onFiltersChange({ ...filters, hasTimeline: undefined })}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.categories?.map((category) => (
            <Badge key={category} variant="secondary" className="flex items-center gap-1">
              {category}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleCategoryFilter(category)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {totalResults} review{totalResults !== 1 ? 's' : ''} found
      </div>
    </div>
  );
};
