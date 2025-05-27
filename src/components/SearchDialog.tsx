
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X, Loader2 } from 'lucide-react';
import { UserResultItem } from './search/UserResultItem';
import { EntityResultItem } from './search/EntityResultItem';
import { SearchResultHandler } from './search/SearchResultHandler';
import { useRealtimeUnifiedSearch } from '@/hooks/use-realtime-unified-search';
import { Badge } from '@/components/ui/badge';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  
  const { 
    results, 
    isLoading, 
    loadingStates, 
    error, 
    classification 
  } = useRealtimeUnifiedSearch(query);

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

  const renderSectionHeader = (title: string, count: number) => (
    <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20 flex items-center justify-between">
      <span>{title}</span>
      <Badge variant="outline" className="text-xs">{count}</Badge>
    </div>
  );

  const renderLoadingState = () => (
    <div className="p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Searching...</span>
      </div>
      {classification && (
        <Badge variant="secondary" className="text-xs">
          {classification.classification} ({Math.round(classification.confidence * 100)}%)
        </Badge>
      )}
    </div>
  );

  const hasResults = results.products.length > 0 || 
                   results.entities.length > 0 || 
                   results.users.length > 0;

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
            <div className="px-4 py-2 text-center text-xs text-destructive">
              {error}
            </div>
          )}

          {(isLoading || Object.values(loadingStates).some(Boolean)) && renderLoadingState()}

          {query && !hasResults && !isLoading && !Object.values(loadingStates).some(Boolean) && (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No suggestions found. Press Enter to search more sources.</p>
            </div>
          )}

          {hasResults && (
            <>
              {results.products.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('External Products', results.products.length)}
                  {results.products.slice(0, 3).map((product, index) => (
                    <SearchResultHandler
                      key={`${product.api_source}-${product.api_ref || index}`}
                      result={product}
                      query={query}
                      onClose={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {results.entities.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Places & Things', results.entities.length)}
                  {results.entities.slice(0, 3).map((entity) => (
                    <EntityResultItem
                      key={entity.id}
                      entity={entity}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {results.users.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('People', results.users.length)}
                  {results.users.slice(0, 3).map((user) => (
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
