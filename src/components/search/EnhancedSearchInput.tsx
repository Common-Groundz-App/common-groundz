import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { useEnhancedRealtimeSearch } from '@/hooks/use-enhanced-realtime-search';
import { EntityResultItem } from './EntityResultItem';
import { UserResultItem } from './UserResultItem';
import { SearchResultHandler } from './SearchResultHandler';
import { useNavigate } from 'react-router-dom';

interface EnhancedSearchInputProps {
  placeholder?: string;
  className?: string;
}

export function EnhancedSearchInput({ 
  placeholder = "Search for people, places, food, products...",
  className = ""
}: EnhancedSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);
  const [showAllResults, setShowAllResults] = useState({
    entities: false,
    users: false,
    books: false,
    movies: false,
    places: false,
    hashtags: false,
  });
  const [isProcessingEntity, setIsProcessingEntity] = useState(false);
  
  const navigate = useNavigate();
  const { results, isLoading, error } = useEnhancedRealtimeSearch(searchQuery);

  const shouldShowDropdown = searchQuery.length > 0;
  const hasLocalResults = results.entities.length > 0 || results.users.length > 0;
  const hasExternalResults = results.categorized?.books?.length > 0 || 
                             results.categorized?.movies?.length > 0 || 
                             results.categorized?.places?.length > 0;
  const hasHashtagResults = results.hashtags?.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleComplexProductSearch();
    }
  };

  const handleComplexProductSearch = () => {
    if (searchQuery.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}&mode=quick`);
      setSearchQuery('');
    }
  };

  const handleResultClick = useCallback((entityId?: string, entityType?: string) => {
    setIsDropdownClosing(true);
    setTimeout(() => {
      setSearchQuery('');
      setIsDropdownClosing(false);
    }, 300);
  }, []);

  const toggleShowAll = (category: keyof typeof showAllResults) => {
    setShowAllResults(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const renderSectionHeader = (title: string, count: number, category: keyof typeof showAllResults) => {
    const isShowingAll = showAllResults[category];
    const hasMore = count > 3;
    
    return (
      <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        {hasMore && (
          <button
            onClick={() => toggleShowAll(category)}
            className="text-xs text-primary hover:underline"
          >
            {isShowingAll ? 'See Less' : `See All (${count})`}
          </button>
        )}
      </div>
    );
  };

  const handleProcessingStart = () => setIsProcessingEntity(true);
  const handleProcessingUpdate = () => {};
  const handleProcessingEnd = () => setIsProcessingEntity(false);

  return (
    <div className={`relative overflow-visible ${className}`}>
      <div className="flex items-center border rounded-lg overflow-hidden bg-background min-w-0">
        <div className="pl-3 text-muted-foreground shrink-0">
          <Search size={18} />
        </div>
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0"
        />
        {searchQuery && (
          <Button 
            variant="default" 
            size="sm"
            className="mr-1 bg-brand-orange hover:bg-brand-orange/90 shrink-0"
            onClick={handleComplexProductSearch}
          >
            More
          </Button>
        )}
      </div>
      
      {/* Enhanced Search Results Dropdown */}
      {shouldShowDropdown && (
        <div className={`absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl z-[60] max-h-[70vh] overflow-y-auto transition-all duration-300 ${
          isDropdownClosing ? 'opacity-0 transform scale-95 translate-y-2' : 'opacity-100 transform scale-100 translate-y-0'
        }`}>
          
          {/* Loading State */}
          {isLoading && (
            <div className="p-3 text-center border-b bg-background">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-3 text-center border-b bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {/* Already on Groundz - Local Results */}
          {results.entities.length > 0 && (
            <div className="border-b last:border-b-0 bg-background">
              {renderSectionHeader('✨ Already on Groundz', results.entities.length, 'entities')}
              {(showAllResults.entities ? results.entities : results.entities.slice(0, 3)).map((entity) => (
                <EntityResultItem
                  key={entity.id}
                  entity={entity}
                  onClick={() => handleResultClick(entity.id, entity.type)}
                />
              ))}
            </div>
          )}

          {/* Books from External APIs */}
          {results.categorized?.books?.length > 0 && (
            <div className="border-b last:border-b-0 bg-background">
              {renderSectionHeader('📚 Books', results.categorized.books.length, 'books')}
              {(showAllResults.books ? results.categorized.books : results.categorized.books.slice(0, 3)).map((book, index) => (
                <SearchResultHandler
                  key={`${book.api_source}-${book.api_ref || index}`}
                  result={book}
                  query={searchQuery}
                  onClose={() => handleResultClick()}
                  isProcessing={isProcessingEntity}
                  onProcessingStart={handleProcessingStart}
                  onProcessingUpdate={handleProcessingUpdate}
                  onProcessingEnd={handleProcessingEnd}
                  useExternalOverlay={true}
                />
              ))}
            </div>
          )}

          {/* Movies from External APIs */}
          {results.categorized?.movies?.length > 0 && (
            <div className="border-b last:border-b-0 bg-background">
              {renderSectionHeader('🎬 Movies', results.categorized.movies.length, 'movies')}
              {(showAllResults.movies ? results.categorized.movies : results.categorized.movies.slice(0, 3)).map((movie, index) => (
                <SearchResultHandler
                  key={`${movie.api_source}-${movie.api_ref || index}`}
                  result={movie}
                  query={searchQuery}
                  onClose={() => handleResultClick()}
                  isProcessing={isProcessingEntity}
                  onProcessingStart={handleProcessingStart}
                  onProcessingUpdate={handleProcessingUpdate}
                  onProcessingEnd={handleProcessingEnd}
                  useExternalOverlay={true}
                />
              ))}
            </div>
          )}

          {/* Places from External APIs */}
          {results.categorized?.places?.length > 0 && (
            <div className="border-b last:border-b-0 bg-background">
              {renderSectionHeader('📍 Places', results.categorized.places.length, 'places')}
              {(showAllResults.places ? results.categorized.places : results.categorized.places.slice(0, 3)).map((place, index) => (
                <SearchResultHandler
                  key={`${place.api_source}-${place.api_ref || index}`}
                  result={place}
                  query={searchQuery}
                  onClose={() => handleResultClick()}
                  isProcessing={isProcessingEntity}
                  onProcessingStart={handleProcessingStart}
                  onProcessingUpdate={handleProcessingUpdate}
                  onProcessingEnd={handleProcessingEnd}
                  useExternalOverlay={true}
                />
              ))}
            </div>
          )}

          {/* Hashtags */}
          {results.hashtags?.length > 0 && (
            <div className="border-b last:border-b-0 bg-background">
              {renderSectionHeader('# Hashtags', results.hashtags.length, 'hashtags')}
              {(showAllResults.hashtags ? results.hashtags : results.hashtags.slice(0, 3)).map((hashtag) => (
                <div
                  key={hashtag.id}
                  onClick={() => {
                    navigate(`/t/${hashtag.name_norm}`);
                    handleResultClick();
                  }}
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-medium">#{hashtag.name_original}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {hashtag.post_count} posts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* People */}
          {results.users.length > 0 && (
            <div className="border-b last:border-b-0 bg-background">
              {renderSectionHeader('👥 People', results.users.length, 'users')}
              {(showAllResults.users ? results.users : results.users.slice(0, 3)).map((user) => (
                <UserResultItem
                  key={user.id}
                  user={user}
                  onClick={() => handleResultClick()}
                />
              ))}
            </div>
          )}

          {/* Complex Product Search Option */}
          {searchQuery.length >= 2 && (
            <div className="p-3 text-center border-t bg-background">
              <button 
                className="text-sm text-primary hover:underline flex items-center justify-center w-full"
                onClick={handleComplexProductSearch}
              >
                <Search className="w-3 h-3 mr-1" />
                Search for "{searchQuery}" in more sources
              </button>
            </div>
          )}

          {/* No Results State */}
          {!hasLocalResults && !hasExternalResults && !hasHashtagResults && !isLoading && (
            <div className="p-4 text-center bg-background">
              <p className="text-sm text-muted-foreground mb-2">No immediate results found</p>
              <button 
                className="text-sm text-primary hover:underline"
                onClick={handleComplexProductSearch}
              >
                Try searching in more sources
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}