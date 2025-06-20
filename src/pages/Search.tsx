
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, AlertCircle, Sparkles, ShoppingCart, Users, MapPin, Film, BookOpen, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useUnifiedSearch } from '@/hooks/use-unified-search';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { UserResultItem } from '@/components/search/UserResultItem';

export default function Search() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const mode = searchParams.get('mode') || 'comprehensive';
  
  const [currentQuery, setCurrentQuery] = useState(query);
  const [isProcessingEntity, setIsProcessingEntity] = useState(false);
  const [showAllResults, setShowAllResults] = useState({
    entities: false,
    users: false,
    books: false,
    movies: false,
    places: false
  });

  // Use unified search to get comprehensive results
  const { results, isLoading, error } = useUnifiedSearch(query, { 
    skipProductSearch: false,
    mode: mode as 'quick' | 'comprehensive'
  });

  // Simple processing handlers for SearchResultHandler
  const handleEntityProcessingStart = (entityName: string, message: string) => {
    setIsProcessingEntity(true);
  };

  const handleEntityProcessingUpdate = (message: string) => {
    // No-op for this page
  };

  const handleEntityProcessingEnd = () => {
    setIsProcessingEntity(false);
  };

  const handleSearch = () => {
    if (currentQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(currentQuery.trim())}&mode=${mode}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleShowAll = (category: keyof typeof showAllResults) => {
    setShowAllResults(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const renderSectionHeader = (title: string, count: number, categoryKey?: keyof typeof showAllResults) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Badge variant="secondary">{count} found</Badge>
      </div>
      {categoryKey && count > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-brand-orange font-semibold hover:text-brand-orange/80"
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
  );

  if (!query) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Search</h1>
            <div className="max-w-md mx-auto">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search for anything..."
                  value={currentQuery}
                  onChange={(e) => setCurrentQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button onClick={handleSearch}>
                  Search
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/explore')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  placeholder="Search for anything..."
                  value={currentQuery}
                  onChange={(e) => setCurrentQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button 
                onClick={handleSearch}
                size="sm"
                className="bg-brand-orange hover:bg-brand-orange/90 shrink-0"
              >
                Search
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="text-muted-foreground">Searching comprehensively...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive/20 bg-destructive/5 mb-6">
            <CardContent className="flex items-center gap-3 p-6">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <h3 className="font-medium text-destructive">Search Error</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!isLoading && !error && (
          <div className="space-y-8">
            {/* Database Entities */}
            {results.entities.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    {renderSectionHeader('From CommonGroundz', results.entities.length, 'entities')}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(showAllResults.entities ? results.entities : results.entities.slice(0, 3)).map((entity) => (
                    <EntityResultItem
                      key={entity.id}
                      entity={entity}
                      onClick={() => navigate(`/entity/${entity.slug || entity.id}`)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Users */}
            {results.users.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    {renderSectionHeader('People', results.users.length, 'users')}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(showAllResults.users ? results.users : results.users.slice(0, 3)).map((user) => (
                    <UserResultItem
                      key={user.id}
                      user={user}
                      onClick={() => navigate(`/profile/${user.username}`)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Books */}
            {results.categorized?.books?.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-green-500" />
                    {renderSectionHeader('Books', results.categorized.books.length, 'books')}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click any result to create an entity and start reviewing!
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(showAllResults.books ? results.categorized.books : results.categorized.books.slice(0, 3)).map((book, index) => (
                    <SearchResultHandler
                      key={`${book.api_source}-${book.api_ref || index}`}
                      result={book}
                      query={query}
                      isProcessing={isProcessingEntity}
                      onProcessingStart={handleEntityProcessingStart}
                      onProcessingUpdate={handleEntityProcessingUpdate}
                      onProcessingEnd={handleEntityProcessingEnd}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Movies */}
            {results.categorized?.movies?.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-purple-500" />
                    {renderSectionHeader('Movies & TV', results.categorized.movies.length, 'movies')}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click any result to create an entity and start reviewing!
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(showAllResults.movies ? results.categorized.movies : results.categorized.movies.slice(0, 3)).map((movie, index) => (
                    <SearchResultHandler
                      key={`${movie.api_source}-${movie.api_ref || index}`}
                      result={movie}
                      query={query}
                      isProcessing={isProcessingEntity}
                      onProcessingStart={handleEntityProcessingStart}
                      onProcessingUpdate={handleEntityProcessingUpdate}
                      onProcessingEnd={handleEntityProcessingEnd}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Places */}
            {results.categorized?.places?.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-500" />
                    {renderSectionHeader('Places', results.categorized.places.length, 'places')}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click any result to create an entity and start reviewing!
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(showAllResults.places ? results.categorized.places : results.categorized.places.slice(0, 3)).map((place, index) => (
                    <SearchResultHandler
                      key={`${place.api_source}-${place.api_ref || index}`}
                      result={place}
                      query={query}
                      isProcessing={isProcessingEntity}
                      onProcessingStart={handleEntityProcessingStart}
                      onProcessingUpdate={handleEntityProcessingUpdate}
                      onProcessingEnd={handleEntityProcessingEnd}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* External Products */}
            {results.products.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-orange-500" />
                    <CardTitle className="text-lg">Products from the Web</CardTitle>
                    <Badge variant="secondary" className="ml-auto">
                      {results.products.length} found
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click any result to create an entity and start reviewing!
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {results.products.map((product, index) => (
                    <SearchResultHandler
                      key={`${product.api_source}-${product.api_ref}-${index}`}
                      result={product}
                      query={query}
                      isProcessing={isProcessingEntity}
                      onProcessingStart={handleEntityProcessingStart}
                      onProcessingUpdate={handleEntityProcessingUpdate}
                      onProcessingEnd={handleEntityProcessingEnd}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* No Results */}
            {!isLoading && 
             results.entities.length === 0 && 
             results.users.length === 0 && 
             results.products.length === 0 &&
             (!results.categorized || (
               results.categorized.books.length === 0 &&
               results.categorized.movies.length === 0 &&
               results.categorized.places.length === 0
             )) && (
              <Card>
                <CardContent className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Results Found</h3>
                  <p className="text-muted-foreground mb-4">
                    We couldn't find any results matching "{query}"
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={() => navigate('/explore')} variant="outline">
                      Browse Categories
                    </Button>
                    <Button onClick={() => setCurrentQuery('')}>
                      Try Different Search
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
