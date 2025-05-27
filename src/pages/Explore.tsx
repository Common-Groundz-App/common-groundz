
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { UserDirectoryList } from '@/components/explore/UserDirectoryList';
import { cn } from '@/lib/utils';
import { Filter, Users, Search, Film, Book, MapPin, ShoppingBag, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useEnhancedSearch } from '@/hooks/use-enhanced-search';
import { UserResultItem } from '@/components/search/UserResultItem';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { FeaturedEntities } from '@/components/explore/FeaturedEntities';
import { CategoryHighlights } from '@/components/explore/CategoryHighlights';
import { Badge } from '@/components/ui/badge';

const Explore = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Use the enhanced search hook
  const { 
    results, 
    isLoading, 
    loadingStates, 
    error, 
    classification,
    showAllResults,
    toggleShowAll
  } = useEnhancedSearch(searchQuery);

  const handleResultClick = () => {
    setSearchQuery('');
  };

  const handleComplexProductSearch = () => {
    if (searchQuery.trim().length >= 2) {
      console.log(`🎯 Redirecting to complex product search for: "${searchQuery}"`);
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      navigate(`/search/products/${encodedQuery}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleComplexProductSearch();
    }
  };
  
  const getInitialActiveTab = () => {
    return 'Explore';
  };

  if (!user) {
    return <div>Loading...</div>;
  };
  
  const tabItems = [
    {
      value: "featured",
      label: "Featured",
      icon: MapPin
    },
    {
      value: "places",
      label: "Places",
      icon: MapPin
    },
    {
      value: "movies",
      label: "Movies",
      icon: Film
    },
    {
      value: "books",
      label: "Books",
      icon: Book
    },
    {
      value: "food",
      label: "Food",
      icon: ShoppingBag
    },
    {
      value: "products",
      label: "Products",
      icon: ShoppingBag
    },
    {
      value: "people",
      label: "People",
      icon: Users
    }
  ];

  const hasResults = results.products.length > 0 || 
                   results.entities.length > 0 || 
                   results.users.length > 0;

  const hasCategorizedResults = results.categorized.books.length > 0 ||
                               results.categorized.movies.length > 0 ||
                               results.categorized.places.length > 0 ||
                               results.categorized.food.length > 0;

  const renderSectionHeader = (title: string, count: number, categoryKey?: keyof typeof showAllResults) => (
    <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20 flex items-center justify-between">
      <span>{title}</span>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{count}</Badge>
        {categoryKey && count > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => toggleShowAll(categoryKey)}
          >
            {showAllResults[categoryKey] ? (
              <>Less <ChevronUp className="w-3 h-3 ml-1" /></>
            ) : (
              <>All <ChevronDown className="w-3 h-3 ml-1" /></>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-start">
            <Logo size="sm" />
          </div>
        </div>
      )}
      
      <div className="flex flex-1">
        {!isMobile && (
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={cn(
          "flex-1 pt-16 md:pl-64",
        )}>
          <div className="container max-w-4xl mx-auto p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Explore</h1>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
                    <Filter size={16} />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup value={sortOption} onValueChange={setSortOption}>
                    <DropdownMenuRadioItem value="popular">Most Popular</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="recent">Recently Joined</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="active">Most Active</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="relative mb-6">
              <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                <div className="pl-3 text-muted-foreground">
                  <Search size={18} />
                </div>
                <Input
                  type="text"
                  placeholder="Search for people, places, food, products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {searchQuery && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mr-1"
                    onClick={handleComplexProductSearch}
                  >
                    Search More
                  </Button>
                )}
              </div>
              
              {/* Search Classification Info */}
              {classification && searchQuery && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {classification.classification} ({Math.round(classification.confidence * 100)}% confidence)
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {classification.api_used === 'gemini' ? '🤖 Gemini' : 
                     classification.api_used === 'openai' ? '🧠 OpenAI' : 
                     '🔧 Local'}
                  </Badge>
                  {isLoading && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Searching...
                    </div>
                  )}
                </div>
              )}
              
              {/* Enhanced Real-time Search Results */}
              {searchQuery && (hasResults || hasCategorizedResults) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 max-h-[70vh] overflow-y-auto">
                  
                  {/* Loading States */}
                  {(isLoading || Object.values(loadingStates).some(Boolean)) && (
                    <div className="p-3 text-center border-b">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching across all sources...</span>
                      </div>
                      <div className="flex gap-1 mt-2 justify-center flex-wrap">
                        {loadingStates.classification && <Badge variant="outline" className="text-xs">Classifying</Badge>}
                        {loadingStates.local && <Badge variant="outline" className="text-xs">Local</Badge>}
                        {loadingStates.books && <Badge variant="outline" className="text-xs">Books</Badge>}
                        {loadingStates.movies && <Badge variant="outline" className="text-xs">Movies</Badge>}
                        {loadingStates.places && <Badge variant="outline" className="text-xs">Places</Badge>}
                        {loadingStates.food && <Badge variant="outline" className="text-xs">Food</Badge>}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-4 text-center text-destructive text-sm">
                      {error}
                    </div>
                  )}
                  
                  {/* Your Database - Priority Section */}
                  {results.entities.length > 0 && (
                    <div className="border-b last:border-b-0">
                      {renderSectionHeader('✨ Your Database', results.entities.length, 'entities')}
                      {(showAllResults.entities ? results.entities : results.entities.slice(0, 3)).map((entity) => (
                        <EntityResultItem
                          key={entity.id}
                          entity={entity}
                          onClick={handleResultClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Books from External APIs */}
                  {results.categorized.books.length > 0 && (
                    <div className="border-b last:border-b-0">
                      {renderSectionHeader('📚 Books', results.categorized.books.length, 'books')}
                      {(showAllResults.books ? results.categorized.books : results.categorized.books.slice(0, 3)).map((book, index) => (
                        <SearchResultHandler
                          key={`${book.api_source}-${book.api_ref || index}`}
                          result={book}
                          query={searchQuery}
                          onClose={handleResultClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Movies from External APIs */}
                  {results.categorized.movies.length > 0 && (
                    <div className="border-b last:border-b-0">
                      {renderSectionHeader('🎬 Movies', results.categorized.movies.length, 'movies')}
                      {(showAllResults.movies ? results.categorized.movies : results.categorized.movies.slice(0, 3)).map((movie, index) => (
                        <SearchResultHandler
                          key={`${movie.api_source}-${movie.api_ref || index}`}
                          result={movie}
                          query={searchQuery}
                          onClose={handleResultClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Places from External APIs */}
                  {results.categorized.places.length > 0 && (
                    <div className="border-b last:border-b-0">
                      {renderSectionHeader('📍 Places', results.categorized.places.length, 'places')}
                      {(showAllResults.places ? results.categorized.places : results.categorized.places.slice(0, 3)).map((place, index) => (
                        <SearchResultHandler
                          key={`${place.api_source}-${place.api_ref || index}`}
                          result={place}
                          query={searchQuery}
                          onClose={handleResultClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Food from External APIs */}
                  {results.categorized.food.length > 0 && (
                    <div className="border-b last:border-b-0">
                      {renderSectionHeader('🍽️ Food & Recipes', results.categorized.food.length, 'food')}
                      {(showAllResults.food ? results.categorized.food : results.categorized.food.slice(0, 3)).map((food, index) => (
                        <SearchResultHandler
                          key={`${food.api_source}-${food.api_ref || index}`}
                          result={food}
                          query={searchQuery}
                          onClose={handleResultClick}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* People */}
                  {results.users.length > 0 && (
                    <div className="border-b last:border-b-0">
                      {renderSectionHeader('👥 People', results.users.length, 'users')}
                      {(showAllResults.users ? results.users : results.users.slice(0, 3)).map((user) => (
                        <UserResultItem
                          key={user.id}
                          user={user}
                          onClick={handleResultClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Complex Product Search Option */}
                  {searchQuery.length >= 2 && (
                    <div className="p-3 text-center border-t">
                      <button 
                        className="text-sm text-primary hover:underline flex items-center justify-center w-full"
                        onClick={handleComplexProductSearch}
                      >
                        <Search className="w-3 h-3 mr-1" />
                        Search more products for "{searchQuery}"
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* No Results */}
              {searchQuery && !hasResults && !hasCategorizedResults && !isLoading && !Object.values(loadingStates).some(Boolean) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 p-4 text-center">
                  <p className="text-sm text-muted-foreground">No results found locally. Try searching for more products.</p>
                  <button 
                    className="text-sm text-primary hover:underline mt-2"
                    onClick={handleComplexProductSearch}
                  >
                    Search external sources for "{searchQuery}"
                  </button>
                </div>
              )}
            </div>
            
            <TubelightTabs defaultValue="featured" items={tabItems}>
              <TabsContent value="featured">
                <div className="space-y-8">
                  <FeaturedEntities />
                  <CategoryHighlights />
                </div>
              </TabsContent>
              <TabsContent value="places">
                <CategoryHighlights entityType="place" />
              </TabsContent>
              <TabsContent value="movies">
                <CategoryHighlights entityType="movie" />
              </TabsContent>
              <TabsContent value="books">
                <CategoryHighlights entityType="book" />
              </TabsContent>
              <TabsContent value="food">
                <CategoryHighlights entityType="food" />
              </TabsContent>
              
              <TabsContent value="products">
                <div className="mt-4 p-8 text-center">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">Discover Products</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Search for products to get comprehensive analysis from reviews, forums, and multiple sources
                  </p>
                  <div className="flex items-center justify-center">
                    <div className="relative flex-1 max-w-md">
                      <Input
                        type="text"
                        placeholder="Search for products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pr-20"
                      />
                      <Button 
                        className="absolute right-0 top-0 rounded-l-none"
                        onClick={handleComplexProductSearch}
                      >
                        Search
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="people">
                <UserDirectoryList sortOption={sortOption} />
              </TabsContent>
            </TubelightTabs>
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Explore;
