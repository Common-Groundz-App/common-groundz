
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useEnhancedRealtimeSearch } from '@/hooks/use-enhanced-realtime-search';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { EntityResultItem } from '@/components/search/EntityResultItem';

interface AdminEntityCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityCreated?: () => void;
}

export const AdminEntityCreationDialog = ({ open, onOpenChange, onEntityCreated }: AdminEntityCreationDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  // Use the same search hook as the Explore page
  const { 
    results, 
    isLoading, 
    error,
    showAllResults,
    toggleShowAll
  } = useEnhancedRealtimeSearch(searchQuery, { mode: 'quick' });

  const handleResultClick = async () => {
    // Start dropdown closing animation
    setIsDropdownClosing(true);
    
    // Clear search and close dialog after animation
    setTimeout(() => {
      setSearchQuery('');
      setIsDropdownClosing(false);
      onEntityCreated?.();
      onOpenChange(false);
    }, 300);
  };

  const handleEntityCreated = () => {
    onEntityCreated?.();
    onOpenChange(false);
  };

  const handleManualCreation = () => {
    setShowManualForm(true);
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

  const hasLocalResults = results.entities.length > 0;
  const hasExternalResults = results.categorized.books.length > 0 ||
                            results.categorized.movies.length > 0 ||
                            results.categorized.places.length > 0;

  // Show dropdown when user has typed at least 1 character and not closing
  const shouldShowDropdown = searchQuery && searchQuery.trim().length >= 1 && !isDropdownClosing;

  if (showManualForm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Entity Manually
            </DialogTitle>
            <DialogDescription>
              Create a new entity with custom information
            </DialogDescription>
          </DialogHeader>
          {/* Manual form will be implemented in Phase 3 */}
          <div className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Manual entity creation form coming in Phase 3...</p>
            <Button variant="outline" onClick={() => setShowManualForm(false)}>
              Back to Search
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Entity
          </DialogTitle>
          <DialogDescription>
            Search for entities from external APIs or create manually
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search Input - Same as Explore page */}
          <div className="relative overflow-visible">
            <div className="flex items-center border rounded-lg overflow-hidden bg-background min-w-0">
              <div className="pl-3 text-muted-foreground shrink-0">
                <Search size={18} />
              </div>
              <Input
                type="text"
                placeholder="Search for movies, books, places to create new entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0"
              />
              <Button 
                variant="outline" 
                size="sm"
                className="mr-1 shrink-0"
                onClick={handleManualCreation}
              >
                Add Manually
              </Button>
            </div>
            
            {/* Search Results Dropdown - Same structure as Explore page */}
            {shouldShowDropdown && (
              <div className={`absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl z-[60] max-h-[50vh] overflow-y-auto transition-all duration-300 ${
                isDropdownClosing ? 'opacity-0 transform scale-95 translate-y-2' : 'opacity-100 transform scale-100 translate-y-0'
              }`}>
                
                {/* Loading State */}
                {isLoading && (
                  <div className="p-3 text-center border-b bg-background">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching for entities to create...</span>
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
                        onClick={() => handleResultClick()}
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
                        onClose={handleResultClick}
                        onEntityCreated={handleEntityCreated}
                        useExternalOverlay={false}
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
                        onClose={handleResultClick}
                        onEntityCreated={handleEntityCreated}
                        useExternalOverlay={false}
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
                        onClose={handleResultClick}
                        onEntityCreated={handleEntityCreated}
                        useExternalOverlay={false}
                      />
                    ))}
                  </div>
                )}

                {/* Add Manually Option */}
                {searchQuery.length >= 2 && (
                  <div className="p-3 text-center border-t bg-background">
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={handleManualCreation}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add "{searchQuery}" manually
                    </Button>
                  </div>
                )}

                {/* No Results State */}
                {!hasLocalResults && !hasExternalResults && !isLoading && (
                  <div className="p-4 text-center bg-background">
                    <p className="text-sm text-muted-foreground mb-3">No entities found for "{searchQuery}"</p>
                    <Button 
                      variant="default"
                      onClick={handleManualCreation}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create "{searchQuery}" manually
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
