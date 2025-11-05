
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X, Loader2, ChevronDown, ChevronUp, AlertCircle, Hash, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserResultItem } from './search/UserResultItem';
import { EntityResultItem } from './search/EntityResultItem';
import { SearchResultHandler } from './search/SearchResultHandler';
import { useEnhancedRealtimeSearch } from '@/hooks/use-enhanced-realtime-search';
import { Button } from '@/components/ui/button';
import { TrendingHashtags } from '@/components/hashtag/TrendingHashtags';
import { getTrendingHashtags, HashtagWithCount, searchHashtagsPartial } from '@/services/hashtagService';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  // Trending hashtags state
  const [trendingHashtags, setTrendingHashtags] = useState<HashtagWithCount[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Load trending hashtags when dialog opens
  React.useEffect(() => {
    if (open) {
      const loadTrendingHashtags = async () => {
        try {
          setTrendingLoading(true);
          const hashtags = await getTrendingHashtags(4);
          setTrendingHashtags(hashtags);
        } catch (error) {
          console.error('Failed to load trending hashtags:', error);
        } finally {
          setTrendingLoading(false);
        }
      };

      loadTrendingHashtags();
    }
  }, [open]);
  
  // Enhanced search with partial matching
  const { 
    results, 
    isLoading, 
    loadingStates, 
    error,
    showAllResults,
    toggleShowAll
  } = useEnhancedRealtimeSearch(query, { mode: 'quick' });

  // Enhanced hashtag search state
  const [enhancedHashtags, setEnhancedHashtags] = useState<HashtagWithCount[]>([]);
  
  // Enhanced hashtag search with partial matching
  useEffect(() => {
    const searchHashtags = async () => {
      if (query.trim().length >= 1) {
        try {
          const partialResults = await searchHashtagsPartial(query.trim(), 5);
          setEnhancedHashtags(partialResults);
        } catch (error) {
          console.error('Error searching hashtags:', error);
          setEnhancedHashtags([]);
        }
      } else {
        setEnhancedHashtags([]);
      }
    };

    const debounceTimer = setTimeout(searchHashtags, 200);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleResultClick = () => {
    onOpenChange(false);
    setQuery('');
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim().length >= 1) {
      navigate(`/search?q=${encodeURIComponent(query)}&mode=quick`);
      onOpenChange(false);
    }
  };

  const renderSectionHeader = (title: string, count: number, isLoading?: boolean, categoryKey?: keyof typeof showAllResults) => (
    <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20 flex items-center justify-between">
      <span className="flex items-center gap-2">
        {title} ({count})
        {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
      </span>
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
      <div className="flex gap-1 justify-center flex-wrap">
        {loadingStates.external && <span className="text-xs text-muted-foreground">📚 Books</span>}
        {loadingStates.external && <span className="text-xs text-muted-foreground">🎬 Movies</span>}
        {loadingStates.external && <span className="text-xs text-muted-foreground">📍 Places</span>}
      </div>
    </div>
  );

  const hasLocalResults = results.entities.length > 0 || results.users.length > 0;
  const hasExternalResults = results.categorized?.books?.length > 0 ||
                            results.categorized?.movies?.length > 0 ||
                            results.categorized?.places?.length > 0;
  const hasHashtagResults = (results.hashtags && results.hashtags.length > 0) || enhancedHashtags.length > 0;

  // Show dropdown for any query with 1+ characters
  const shouldShowDropdown = query.trim().length >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden shadow-lg border-0">
        <div className="flex items-center py-3 px-4">
          <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-2" />
          <Input
            type="text"
            placeholder="Search for people, places, products..."
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

        {shouldShowDropdown && (
          <div className="max-h-[70vh] overflow-y-auto">

            {/* Global Error State */}
            {error && (
              <div className="p-3 text-center border-b bg-red-50">
                <div className="flex items-center justify-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Loading State - Show immediately while searching */}
            {(isLoading || Object.values(loadingStates).some(Boolean)) && renderLoadingState()}

            {/* Search Results */}
            {(hasLocalResults || hasExternalResults || hasHashtagResults) && (
              <>
                {/* Enhanced Hashtags with partial matching */}
                {hasHashtagResults && (
                  <div className="flex flex-col">
                    {renderSectionHeader('# Hashtags', enhancedHashtags.length || results.hashtags?.length || 0, false)}
                    {(enhancedHashtags.length > 0 ? enhancedHashtags : results.hashtags)?.slice(0, 3).map((hashtag) => (
                      <div
                        key={hashtag.id}
                        onClick={() => {
                          navigate(`/t/${hashtag.name_norm}`);
                          handleResultClick();
                        }}
                        className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer border-b border-border/50 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <Hash className="w-4 h-4 text-primary" />
                          <div>
                            <p className="font-medium text-sm">#{hashtag.name_original}</p>
                            <p className="text-xs text-muted-foreground">{hashtag.post_count} posts</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Already on Groundz - Local Results */}
                {results.entities.length > 0 && (
                  <div className="flex flex-col">
                    {renderSectionHeader('✨ Already on Groundz', results.entities.length, false, 'entities')}
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
                    {renderSectionHeader('Books', results.categorized.books.length, loadingStates.external, 'books')}
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
                    {renderSectionHeader('Movies & TV', results.categorized.movies.length, loadingStates.external, 'movies')}
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
                    {renderSectionHeader('Places', results.categorized.places.length, loadingStates.external, 'places')}
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

                {/* People */}
                {results.users.length > 0 && (
                  <div className="flex flex-col">
                    {renderSectionHeader('People', results.users.length, false, 'users')}
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

            {/* No Results State - only show if not loading and no results */}
            {shouldShowDropdown && !hasLocalResults && !hasExternalResults && !hasHashtagResults && !isLoading && !Object.values(loadingStates).some(Boolean) && (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No suggestions found. Press Enter to search more sources.
                </p>
              </div>
            )}

            {/* Search More + Create Entity Footer */}
            {shouldShowDropdown && (
              <div className="border-t">
                {/* Existing Search More Button */}
                <div className="p-3 text-center">
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
                
                {/* NEW: Create Entity Prompt - Only show when minimal/no results */}
                {(!hasLocalResults || results.entities.length <= 2) && (
                  <div className="p-3 text-center bg-muted/30 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      Couldn't find "<span className="font-medium text-foreground">{query}</span>"?
                    </p>
                    <button 
                      className="text-sm text-brand-orange hover:text-brand-orange/80 font-medium flex items-center justify-center w-full"
                      onClick={() => {
                        console.log('TODO: Open create entity dialog for:', query);
                        // Will be functional in next phase
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Entity
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Show trending hashtags when search is empty */}
        {!shouldShowDropdown && (
          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">🔥 Trending Now</h3>
            <TrendingHashtags 
              hashtags={trendingHashtags}
              isLoading={trendingLoading}
              displayMode="compact"
              limit={4}
              showGrowth={false}
              onHashtagClick={(hashtag) => {
                navigate(`/t/${hashtag}`);
                onOpenChange(false);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
