import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  Hash, 
  Sparkles,
  X,
  Calendar,
  Heart,
  MessageCircle,
  ArrowRight
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SearchFilters {
  dateRange: 'all' | 'day' | 'week' | 'month';
  postType: 'all' | 'text' | 'media' | 'discussion';
  sortBy: 'recent' | 'popular' | 'engagement';
}

interface SearchSuggestion {
  text: string;
  type: 'term' | 'user' | 'hashtag';
  count?: number;
}

interface EnhancedHashtagSearchProps {
  hashtag: string;
  onSearch: (query: string, filters: SearchFilters) => void;
  isSearching: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onNavigateToGlobalSearch: (query: string) => void;
}

export const EnhancedHashtagSearch: React.FC<EnhancedHashtagSearchProps> = ({
  hashtag,
  onSearch,
  isSearching,
  searchQuery,
  onSearchQueryChange,
  onNavigateToGlobalSearch
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: 'all',
    postType: 'all',
    sortBy: 'recent'
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`hashtag-searches-${hashtag}`);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      } catch (e) {
        console.error('Error loading recent searches:', e);
      }
    }
  }, [hashtag]);

  // Generate search suggestions based on hashtag and input
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Show popular terms and recent searches when no input
      const popularSuggestions: SearchSuggestion[] = [
        { text: 'reviews', type: 'term', count: 45 },
        { text: 'recommendations', type: 'term', count: 32 },
        { text: 'experience', type: 'term', count: 28 },
        { text: 'tips', type: 'term', count: 21 },
        { text: 'opinion', type: 'term', count: 18 }
      ];
      
      const recentSuggestions = recentSearches.map(search => ({
        text: search,
        type: 'term' as const
      }));

      setSuggestions([...recentSuggestions, ...popularSuggestions].slice(0, 6));
    } else {
      // Generate contextual suggestions based on input
      const contextualSuggestions: SearchSuggestion[] = [
        { text: `${searchQuery} reviews`, type: 'term' },
        { text: `${searchQuery} tips`, type: 'term' },
        { text: `best ${searchQuery}`, type: 'term' },
        { text: `${searchQuery} experience`, type: 'term' }
      ];
      setSuggestions(contextualSuggestions);
    }
  }, [searchQuery, recentSearches]);

  const handleSearch = (query: string = searchQuery) => {
    if (!query.trim()) return;

    // Save to recent searches
    const newRecentSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecentSearches);
    localStorage.setItem(`hashtag-searches-${hashtag}`, JSON.stringify(newRecentSearches));

    onSearch(query, filters);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter navigates to global search
        onNavigateToGlobalSearch(searchQuery);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (searchQuery.trim()) {
      onSearch(searchQuery, newFilters);
    }
  };

  const clearSearch = () => {
    onSearchQueryChange('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== 'all' && value !== 'recent'
  );

  return (
    <div className="relative">
      {/* Main Search Input */}
      <div className="relative">
        <div className="flex items-center border rounded-lg overflow-hidden bg-background">
          <div className="pl-3 text-muted-foreground shrink-0">
            <Search size={18} />
          </div>
          <Input
            ref={inputRef}
            type="text"
            placeholder={`Search within #${hashtag}...`}
            value={searchQuery}
            onChange={(e) => {
              onSearchQueryChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 mr-1">
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="h-8 w-8 p-0"
              >
                <X size={14} />
              </Button>
            )}
            
            {/* Filters Popover */}
            <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 w-8 p-0 ${hasActiveFilters ? 'text-primary' : ''}`}
                >
                  <Filter size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium">Search Filters</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Date Range</label>
                      <Select
                        value={filters.dateRange}
                        onValueChange={(value) => handleFilterChange('dateRange', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All time</SelectItem>
                          <SelectItem value="day">Past 24 hours</SelectItem>
                          <SelectItem value="week">Past week</SelectItem>
                          <SelectItem value="month">Past month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Post Type</label>
                      <Select
                        value={filters.postType}
                        onValueChange={(value) => handleFilterChange('postType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All posts</SelectItem>
                          <SelectItem value="text">Text posts</SelectItem>
                          <SelectItem value="media">Media posts</SelectItem>
                          <SelectItem value="discussion">Discussions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Sort By</label>
                      <Select
                        value={filters.sortBy}
                        onValueChange={(value) => handleFilterChange('sortBy', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recent">Most recent</SelectItem>
                          <SelectItem value="popular">Most popular</SelectItem>
                          <SelectItem value="engagement">Most engagement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilters({
                          dateRange: 'all',
                          postType: 'all',
                          sortBy: 'recent'
                        });
                        if (searchQuery.trim()) {
                          onSearch(searchQuery, {
                            dateRange: 'all',
                            postType: 'all',
                            sortBy: 'recent'
                          });
                        }
                      }}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {searchQuery && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onNavigateToGlobalSearch(searchQuery)}
                className="bg-primary hover:bg-primary/90 text-xs px-2 shrink-0"
              >
                <span className="max-[400px]:hidden">Search All</span>
                <span className="min-[401px]:hidden">All</span>
                <ArrowRight size={12} className="ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Loading Indicator */}
        {isSearching && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-2">
          {filters.dateRange !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              <Calendar size={10} className="mr-1" />
              {filters.dateRange === 'day' && 'Past 24h'}
              {filters.dateRange === 'week' && 'Past week'}
              {filters.dateRange === 'month' && 'Past month'}
            </Badge>
          )}
          {filters.postType !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              {filters.postType}
            </Badge>
          )}
          {filters.sortBy !== 'recent' && (
            <Badge variant="secondary" className="text-xs">
              {filters.sortBy === 'popular' && (
                <>
                  <Heart size={10} className="mr-1" />
                  Popular
                </>
              )}
              {filters.sortBy === 'engagement' && (
                <>
                  <MessageCircle size={10} className="mr-1" />
                  Most engagement
                </>
              )}
            </Badge>
          )}
        </div>
      )}

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto">
          <CardContent className="p-2">
            <div className="space-y-1">
              {!searchQuery.trim() && recentSearches.length > 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">Recent searches</div>
              )}
              
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onSearchQueryChange(suggestion.text);
                    handleSearch(suggestion.text);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted/50 text-left"
                >
                  {suggestion.type === 'term' && !searchQuery.trim() && recentSearches.includes(suggestion.text) ? (
                    <Clock size={14} className="text-muted-foreground shrink-0" />
                  ) : suggestion.type === 'user' ? (
                    <User size={14} className="text-muted-foreground shrink-0" />
                  ) : suggestion.type === 'hashtag' ? (
                    <Hash size={14} className="text-muted-foreground shrink-0" />
                  ) : (
                    <Sparkles size={14} className="text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 truncate">{suggestion.text}</span>
                  {suggestion.count && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {suggestion.count}
                    </span>
                  )}
                </button>
              ))}

              {searchQuery.trim() && (
                <div className="border-t pt-2 mt-2">
                  <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                    Tip: Press Shift+Enter to search across all hashtags
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Click outside to close suggestions */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
};