
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X, Loader2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { UserResultItem } from './search/UserResultItem';
import { EntityResultItem } from './search/EntityResultItem';
import { SearchResultHandler } from './search/SearchResultHandler';
import { useRealtimeUnifiedSearch } from '@/hooks/use-realtime-unified-search';
import { Button } from '@/components/ui/button';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  // Use the working realtime unified search hook
  const { 
    results, 
    isLoading, 
    loadingStates, 
    error,
    showAllResults,
    toggleShowAll
  } = useRealtimeUnifiedSearch(query, { mode: 'quick' });

  const handleResultClick = () => {
    onOpenChange(false);
    setQuery('');
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(query)}&mode=quick`);
      onOpenChange(false);
    }
  };

  const renderSectionHeader = (title: string, count: number, categoryKey?: keyof typeof showAllResults) => (
    <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20 flex items-center justify-between">
      <span>{title} ({count})</span>
      <div className="flex items-center gap-2">
        {categoryKey && count > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-brand-orange font-semibold hover:text-brand-orange/80"
            onClick={() => toggleShowAll(categoryKey)}
          >
            {showAllResults[categoryKey] ? (
              <>See Less <ChevronUp className="w-3 h-3 ml-1" /></>
            ) : (
              <>See More <ChevronDown className="w-3 h-3 ml-1" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  const renderLoadingState = () => (
    <div className="p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Searching...</span>
      </div>
    </div>
  );

  const hasLocalResults = results.entities.length > 0 || results.users.length > 0;
  const hasExternalResults = results.categorized?.books?.length > 0 ||
                            results.categorized?.movies?.length > 0 ||
                            results.categorized?.places?.length > 0 ||
                            results.categorized?.food?.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden shadow-lg border-0">
        <div className="flex items-center py-3 px-4">
          <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-2" />
          <Input
            type="text"
            placeholder="Search for people, places, food, products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 text-sm h-8 px-0"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full hover:bg-transparent"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {/* Error State */}
          {error && (
            <div className="p-3 text-center border-b bg-yellow-50">
              <div className="flex items-center justify-center gap-2 text-sm text-yellow-700">
                <AlertCircle className="w-4 h-4" />
                <span>Some search sources are unavailable</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && renderLoadingState()}

          {/* No Results State */}
          {query && !hasLocalResults && !hasExternalResults && !isLoading && (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No suggestions found. Press Enter to search more sources.</p>
            </div>
          )}

          {/* Search Results */}
          {(hasLocalResults || hasExternalResults) && (
            <>
              {/* Already on Groundz - Local Results */}
              {results.entities.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('✨ Already on Groundz', results.entities.length, 'entities')}
                  {(showAllResults.entities ? results.entities : results.entities.slice(0, 3)).map((entity) => (
                    <EntityResultItem
                      key={entity.id}
                      entity={entity}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {/* Books */}
              {results.categorized?.books?.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Books', results.categorized.books.length, 'books')}
                  {(showAllResults.books ? results.categorized.books : results.categorized.books.slice(0, 3)).map((book, index) => (
                    <SearchResultHandler
                      key={`${book.api_source}-${book.api_ref || index}`}
                      result={book}
                      query={query}
                      onClose={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {/* Movies */}
              {results.categorized?.movies?.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Movies & TV', results.categorized.movies.length, 'movies')}
                  {(showAllResults.movies ? results.categorized.movies : results.categorized.movies.slice(0, 3)).map((movie, index) => (
                    <SearchResultHandler
                      key={`${movie.api_source}-${movie.api_ref || index}`}
                      result={movie}
                      query={query}
                      onClose={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {/* Places */}
              {results.categorized?.places?.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Places', results.categorized.places.length, 'places')}
                  {(showAllResults.places ? results.categorized.places : results.categorized.places.slice(0, 3)).map((place, index) => (
                    <SearchResultHandler
                      key={`${place.api_source}-${place.api_ref || index}`}
                      result={place}
                      query={query}
                      onClose={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {/* Food & Recipes */}
              {results.categorized?.food?.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Food & Recipes', results.categorized.food.length, 'food')}
                  {(showAllResults.food ? results.categorized.food : results.categorized.food.slice(0, 3)).map((food, index) => (
                    <SearchResultHandler
                      key={`${food.api_source}-${food.api_ref || index}`}
                      result={food}
                      query={query}
                      onClose={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {/* People */}
              {results.users.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('People', results.users.length, 'users')}
                  {(showAllResults.users ? results.users : results.users.slice(0, 3)).map((user) => (
                    <UserResultItem
                      key={user.id}
                      user={user}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Search More Option */}
          {query.length >= 2 && (
            <div className="p-3 text-center border-t">
              <button 
                className="text-sm text-primary hover:underline flex items-center justify-center w-full"
                onClick={() => {
                  navigate(`/search?q=${encodeURIComponent(query)}&mode=quick`);
                  onOpenChange(false);
                }}
              >
                <Search className="w-3 h-3 mr-1" />
                Search More
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
