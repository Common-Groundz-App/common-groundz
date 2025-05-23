
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useUnifiedSearch } from '@/hooks/use-unified-search';
import { Skeleton } from '@/components/ui/skeleton';
import { UserResultItem } from './search/UserResultItem';
import { EntityResultItem } from './search/EntityResultItem';
import { ReviewResultItem } from './search/ReviewResultItem';
import { RecommendationResultItem } from './search/RecommendationResultItem';
import { ProductResultItem } from './search/ProductResultItem';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const { 
    results, 
    isLoading, 
    error, 
    defaultUsers, 
    loadingDefaultUsers,
    hasResults
  } = useUnifiedSearch(query);

  const handleResultClick = () => {
    onOpenChange(false);
    setQuery('');
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
      <p className="text-sm text-muted-foreground">No results found. Try another name or topic.</p>
    </div>
  );

  // Show default users when not searching
  const shouldShowDefaultUsers = !query && defaultUsers.length > 0;
  
  // Determine if we should show an empty state
  const showEmptyState = query && 
                          query.length >= 2 && 
                          !isLoading && 
                          !hasResults;

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
              {renderSectionHeader('People')}
              {renderLoadingSkeletons(2)}
              {renderSectionHeader('Places')}
              {renderLoadingSkeletons(2)}
              {renderSectionHeader('Reviews')}
              {renderLoadingSkeletons(1)}
            </>
          )}

          {showEmptyState && renderEmptyState()}

          {shouldShowDefaultUsers && (
            <div className="flex flex-col">
              {renderSectionHeader('People You May Know')}
              <div className="flex flex-col">
                {defaultUsers.map((user) => (
                  <UserResultItem
                    key={user.id}
                    user={user}
                    onClick={handleResultClick}
                  />
                ))}
              </div>
            </div>
          )}

          {!isLoading && hasResults && (
            <>
              {results.products && results.products.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Products')}
                  {results.products.map((product, index) => (
                    <ProductResultItem
                      key={`${product.api_source}-${product.api_ref || index}`}
                      product={product}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {results.entities.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Places & Things')}
                  {results.entities.map((entity) => (
                    <EntityResultItem
                      key={entity.id}
                      entity={entity}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {results.reviews.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Reviews')}
                  {results.reviews.map((review) => (
                    <ReviewResultItem
                      key={review.id}
                      review={review}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {results.recommendations.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('Recommendations')}
                  {results.recommendations.map((recommendation) => (
                    <RecommendationResultItem
                      key={recommendation.id}
                      recommendation={recommendation}
                      onClick={handleResultClick}
                    />
                  ))}
                </div>
              )}

              {results.users.length > 0 && (
                <div className="flex flex-col">
                  {renderSectionHeader('People')}
                  <div className="flex flex-col">
                    {results.users.map((user) => (
                      <UserResultItem
                        key={user.id}
                        user={user}
                        onClick={handleResultClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
