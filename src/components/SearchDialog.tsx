
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserResultItem } from './search/UserResultItem';
import { EntityResultItem } from './search/EntityResultItem';
import { ProductResultItem } from './search/ProductResultItem';
import { useLocalSuggestions } from '@/hooks/use-local-suggestions';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { 
    suggestions, 
    isLoading, 
    error
  } = useLocalSuggestions(query);

  const handleResultClick = () => {
    onOpenChange(false);
    setQuery('');
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      onOpenChange(false);
    }
  };

  const renderSectionHeader = (title: string) => (
    <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
      {title}
    </div>
  );

  const renderLoadingSkeletons = (count: number = 3) => (
    <div className="px-2">
      {Array(count).fill(0).map((_, index) => (
        <div key={index} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-2 w-32" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="p-6 text-center">
      <p className="text-sm text-muted-foreground">No suggestions found. Press Enter to search.</p>
    </div>
  );

  // Organize suggestions by type
  const userSuggestions = suggestions.filter(s => s.type === 'user');
  const entitySuggestions = suggestions.filter(s => s.type === 'entity');
  const productSuggestions = suggestions.filter(s => s.type === 'product');
  
  // Determine if we should show an empty state
  const showEmptyState = query && 
                          query.length >= 2 && 
                          !isLoading && 
                          suggestions.length === 0;

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

        <div className="max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="px-4 py-2 text-center text-xs text-muted-foreground">
              {error}
            </div>
          )}

          {isLoading && (
            <>
              {renderSectionHeader('Suggestions')}
              {renderLoadingSkeletons(3)}
            </>
          )}

          {showEmptyState && renderEmptyState()}

          {!isLoading && suggestions.length > 0 && (
            <>
              {productSuggestions.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Products')}
                  {productSuggestions.map((suggestion) => (
                    <ProductResultItem
                      key={suggestion.id}
                      product={{
                        name: suggestion.name,
                        venue: 'Product',
                        description: suggestion.description || null,
                        image_url: suggestion.image_url || '',
                        api_source: 'local_cache',
                        api_ref: suggestion.id,
                        metadata: suggestion.metadata || {}
                      }}
                      query={query}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {entitySuggestions.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Places & Things')}
                  {entitySuggestions.map((suggestion) => (
                    <EntityResultItem
                      key={suggestion.id}
                      entity={{
                        id: suggestion.id,
                        name: suggestion.name,
                        type: 'place',
                        venue: null,
                        image_url: suggestion.image_url || null,
                        description: suggestion.description || null,
                        slug: null
                      }}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {userSuggestions.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('People')}
                  {userSuggestions.map((suggestion) => (
                    <UserResultItem
                      key={suggestion.id}
                      user={{
                        id: suggestion.id,
                        username: suggestion.name,
                        avatar_url: suggestion.image_url || null,
                        bio: suggestion.description || null
                      }}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {query.length >= 2 && (
            <div className="p-3 text-center border-t">
              <button 
                className="text-sm text-primary hover:underline flex items-center justify-center w-full"
                onClick={() => {
                  navigate(`/search?q=${encodeURIComponent(query)}`);
                  onOpenChange(false);
                }}
              >
                <Search className="w-3 h-3 mr-1" />
                Search for "{query}"
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
