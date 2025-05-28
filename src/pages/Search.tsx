import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserResultItem } from '@/components/search/UserResultItem';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { ReviewResultItem } from '@/components/search/ReviewResultItem';
import { RecommendationResultItem } from '@/components/search/RecommendationResultItem';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { cn } from '@/lib/utils';
import { Search as SearchIcon, Users, MapPin, Film, Book, ShoppingBag, AlertCircle, Loader2, Clock, Star, Globe } from 'lucide-react';
import { useRealtimeUnifiedSearch } from '@/hooks/use-realtime-unified-search';
import { Badge } from '@/components/ui/badge';
import { getRandomLoadingMessage } from '@/utils/loadingMessages';

const Search = () => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const mode = searchParams.get('mode') || 'quick';
  const [searchQuery, setSearchQuery] = useState(query);
  const [activeTab, setActiveTab] = useState('all');
  const [isDeepSearching, setIsDeepSearching] = useState(mode === 'deep');
  
  // State for "show all" functionality
  const [showAllStates, setShowAllStates] = useState({
    localResults: false,
    externalResults: false,
    users: false
  });

  // Use the new realtime unified search hook with mode parameter
  const { 
    results, 
    isLoading, 
    loadingStates, 
    error, 
    classification,
    searchMode
  } = useRealtimeUnifiedSearch(query, { mode: mode as 'quick' | 'deep' });

  // Update the URL when search query changes
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      setSearchParams({ q: searchQuery, mode: 'quick' });
    }
  };

  // Handle deep search request
  const handleDeepSearch = () => {
    if (query.trim().length >= 2) {
      setIsDeepSearching(true);
      setSearchParams({ q: query, mode: 'deep' });
    }
  };

  // Handle "View All" button clicks
  const handleViewAll = (section: keyof typeof showAllStates) => {
    if (section === 'users') {
      setActiveTab('users');
    } else {
      setShowAllStates(prev => ({
        ...prev,
        [section]: !prev[section]
      }));
    }
  };

  // Filter results based on active tab using backend categorization
  const getFilteredResults = () => {
    const allLocalResults = [
      ...results.entities,
      ...results.reviews,
      ...results.recommendations
    ];

    // Use categorized results from backend
    const categorizedProducts = {
      movies: results.categorized?.movies || [],
      books: results.categorized?.books || [],
      places: results.categorized?.places || [],
      // General products that don't fall into specific categories - fixed filtering logic
      products: results.products.filter(p => {
        const movieRefs = (results.categorized?.movies || []).map(item => item.api_ref);
        const bookRefs = (results.categorized?.books || []).map(item => item.api_ref);
        const placeRefs = (results.categorized?.places || []).map(item => item.api_ref);
        
        return !movieRefs.includes(p.api_ref) &&
               !bookRefs.includes(p.api_ref) &&
               !placeRefs.includes(p.api_ref);
      })
    };

    switch (activeTab) {
      case 'movies':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'movie') return true;
            if ('category' in item && item.category === 'movie') return true;
            return false;
          }),
          externalResults: categorizedProducts.movies
        };
      case 'books':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'book') return true;
            if ('category' in item && item.category === 'book') return true;
            return false;
          }),
          externalResults: categorizedProducts.books
        };
      case 'places':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'place') return true;
            if ('category' in item && item.category === 'place') return true;
            return false;
          }),
          externalResults: categorizedProducts.places
        };
      case 'products':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'product') return true;
            if ('category' in item && item.category === 'product') return true;
            return false;
          }),
          externalResults: categorizedProducts.products
        };
      case 'users':
        return {
          localResults: [],
          externalResults: [],
          users: results.users
        };
      default: // 'all'
        return {
          localResults: allLocalResults,
          externalResults: results.products,
          users: results.users
        };
    }
  };

  const filteredResults = getFilteredResults();

  // Enhanced loading screen with dynamic messages for all categories
  const renderEnhancedLoadingState = () => {
    const capitalizedQuery = query.charAt(0).toUpperCase() + query.slice(1);
    const category = classification?.classification || 'general';
    const loadingMessage = getRandomLoadingMessage(category as any);

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative mb-6">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
        </div>
        
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          🔍 {searchMode === 'deep' ? 'Deep searching' : 'Searching'} for "{capitalizedQuery}"
        </h2>
        
        <div className="text-center max-w-md">
          <p className="text-muted-foreground mb-4">
            {searchMode === 'deep' ? 
              'Searching comprehensive sources across multiple APIs...' : 
              loadingMessage
            }
          </p>
          
          {classification && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge variant="secondary" className="text-xs">
                {classification.classification} ({Math.round(classification.confidence * 100)}% confidence)
              </Badge>
            </div>
          )}
          
          <div className="flex gap-2 justify-center flex-wrap">
            {searchMode === 'deep' ? (
              <>
                <Badge variant={loadingStates.books ? "default" : "outline"} className="text-xs">
                  📚 Books {loadingStates.books && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
                </Badge>
                <Badge variant={loadingStates.movies ? "default" : "outline"} className="text-xs">
                  🎬 Movies {loadingStates.movies && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
                </Badge>
                <Badge variant={loadingStates.places ? "default" : "outline"} className="text-xs">
                  📍 Places {loadingStates.places && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
                </Badge>
                <Badge variant="default" className="text-xs">
                  🛍️ Products <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                </Badge>
              </>
            ) : (
              <>
                {loadingStates.books && <Badge variant="outline" className="text-xs">📚 Books</Badge>}
                {loadingStates.movies && <Badge variant="outline" className="text-xs">🎬 Movies</Badge>}
                {loadingStates.places && <Badge variant="outline" className="text-xs">📍 Places</Badge>}
                {loadingStates.food && <Badge variant="outline" className="text-xs">🍽️ Food</Badge>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render mixed local results with proper type handling
  const renderLocalResultItem = (item: any) => {
    if ('username' in item) {
      return (
        <UserResultItem
          key={item.id}
          user={item}
          onClick={() => {}}
        />
      );
    } else if ('entity_id' in item && 'rating' in item && 'title' in item && 'description' in item) {
      return (
        <ReviewResultItem
          key={item.id}
          review={item}
          onClick={() => {}}
        />
      );
    } else if ('entity_id' in item && 'title' in item && !('rating' in item)) {
      return (
        <RecommendationResultItem
          key={item.id}
          recommendation={item}
          onClick={() => {}}
        />
      );
    } else if ('name' in item && 'type' in item) {
      return (
        <EntityResultItem
          key={item.id}
          entity={item}
          onClick={() => {}}
        />
      );
    }
    return null;
  };

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
            initialActiveTab="Explore"
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={cn(
          "flex-1 pt-16 md:pl-64",
        )}>
          <div className="container max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Search</h1>
            
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search for people, places, products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit">Search</Button>
              </div>
            </form>

            {/* Search Mode Indicator */}
            {query && (
              <div className="mb-4 flex items-center gap-2">
                <Badge variant={searchMode === 'quick' ? 'outline' : 'default'} className="text-xs">
                  {searchMode === 'quick' ? 'Quick Search' : 'Deep Search'}
                </Badge>
                {classification && (
                  <Badge variant="secondary" className="text-xs">
                    {classification.classification} ({Math.round(classification.confidence * 100)}%)
                  </Badge>
                )}
              </div>
            )}
            
            {query ? (
              <>
                <Tabs 
                  defaultValue="all" 
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="mb-6"
                >
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="movies">Movies</TabsTrigger>
                    <TabsTrigger value="books">Books</TabsTrigger>
                    <TabsTrigger value="places">Places</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="users">People</TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-6">
                    {isLoading || Object.values(loadingStates).some(Boolean) ? (
                      renderEnhancedLoadingState()
                    ) : error ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
                        <p className="text-muted-foreground">{error}</p>
                      </div>
                    ) : (
                      <>
                        <TabsContent value="all">
                          {/* Already on Groundz section - Priority 1 */}
                          {filteredResults.localResults.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Star className="h-5 w-5 text-yellow-500" /> Already on Groundz
                              </h2>
                              <div className="border rounded-md overflow-hidden">
                                {(showAllStates.localResults ? filteredResults.localResults : filteredResults.localResults.slice(0, 5)).map((item) => renderLocalResultItem(item))}
                              </div>
                              {filteredResults.localResults.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => handleViewAll('localResults')}
                                  >
                                    {showAllStates.localResults ? 'Show less' : `View all ${filteredResults.localResults.length} items`}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* All Items section */}
                          {filteredResults.externalResults.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Globe className="h-5 w-5" /> All Items
                              </h2>
                              <p className="text-sm text-muted-foreground mb-4">
                                Everything we found related to your search.
                              </p>
                              <div className="space-y-2">
                                {(showAllStates.externalResults ? filteredResults.externalResults : filteredResults.externalResults.slice(0, 8)).map((product, index) => (
                                  <SearchResultHandler
                                    key={`${product.api_source}-${product.api_ref || index}`}
                                    result={product}
                                    query={query}
                                  />
                                ))}
                              </div>
                              {filteredResults.externalResults.length > 8 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => handleViewAll('externalResults')}
                                  >
                                    {showAllStates.externalResults ? 'Show less' : `View all ${filteredResults.externalResults.length} items`}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* People section */}
                          {results.users.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5" /> People
                              </h2>
                              <div className="border rounded-md overflow-hidden">
                                {results.users.slice(0, 5).map((user) => (
                                  <UserResultItem
                                    key={user.id}
                                    user={user}
                                    onClick={() => {}}
                                  />
                                ))}
                              </div>
                              {results.users.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => handleViewAll('users')}
                                  >
                                    View all {results.users.length} people
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Enhanced Deep Search CTA for all tabs when no results */}
                          {searchMode === 'quick' && (
                            <div className="mb-8 p-6 border border-dashed rounded-lg text-center bg-gradient-to-br from-muted/30 to-muted/10">
                              <h3 className="text-lg font-semibold mb-2">🔍 Want more comprehensive results?</h3>
                              <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
                                Deep Search analyzes multiple sources including specialized APIs for movies, books, places, and products
                                <br />
                                <span className="text-xs italic">(Enhanced search across all categories - may take up to 2 minutes)</span>
                              </p>
                              <Button 
                                onClick={handleDeepSearch}
                                variant="default"
                                className="bg-brand-orange hover:bg-brand-orange/90"
                                disabled={isDeepSearching}
                              >
                                {isDeepSearching ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Deep searching all categories...
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-4 h-4 mr-2" />
                                    Run Deep Search
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          
                          {/* No results message */}
                          {!filteredResults.localResults.length && 
                           !filteredResults.externalResults.length && 
                           !results.users.length && (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No results found for "{query}"</p>
                              {searchMode === 'quick' && (
                                <Button 
                                  onClick={handleDeepSearch} 
                                  variant="outline" 
                                  className="mt-4"
                                  disabled={isDeepSearching}
                                >
                                  {isDeepSearching ? 'Searching deeply...' : 'Try Deep Search'}
                                </Button>
                              )}
                            </div>
                          )}
                        </TabsContent>
                        
                        {/* Category-specific tabs */}
                        <TabsContent value="movies">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Film className="h-5 w-5" /> Movies
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Movies
                                  </h3>
                                  <div className="space-y-2">
                                    {filteredResults.externalResults.map((movie, index) => (
                                      <SearchResultHandler
                                        key={`${movie.api_source}-${movie.api_ref || index}`}
                                        result={movie}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No movies found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="books">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Book className="h-5 w-5" /> Books
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Books
                                  </h3>
                                  <div className="space-y-2">
                                    {filteredResults.externalResults.map((book, index) => (
                                      <SearchResultHandler
                                        key={`${book.api_source}-${book.api_ref || index}`}
                                        result={book}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No books found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="places">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <MapPin className="h-5 w-5" /> Places
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Places
                                  </h3>
                                  <div className="space-y-2">
                                    {filteredResults.externalResults.map((place, index) => (
                                      <SearchResultHandler
                                        key={`${place.api_source}-${place.api_ref || index}`}
                                        result={place}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No places found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="products">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5" /> Products
                          </h2>
                          
                          {/* Deep Search CTA for products tab */}
                          {searchMode === 'quick' && filteredResults.externalResults.length === 0 && (
                            <div className="mb-8 p-4 border border-dashed rounded-lg text-center bg-muted/20">
                              <h3 className="text-lg font-semibold mb-2">🔍 Didn't find what you're looking for?</h3>
                              <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
                                Try Deep Search to find comprehensive results from across the web
                                <br />
                                <span className="text-xs italic">(May take up to 2 minutes for in-depth results)</span>
                              </p>
                              <Button 
                                onClick={handleDeepSearch}
                                variant="default"
                                className="bg-brand-orange hover:bg-brand-orange/90"
                                disabled={isDeepSearching}
                              >
                                {isDeepSearching ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Searching deeply...
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-4 h-4 mr-2" />
                                    Run Deep Search
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                          
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Products
                                  </h3>
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Click any result to create an entity and start reviewing!
                                  </p>
                                  <div className="space-y-2">
                                    {filteredResults.externalResults.map((product, index) => (
                                      <SearchResultHandler
                                        key={`${product.api_source}-${product.api_ref || index}`}
                                        result={product}
                                        query={query}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No products found for "{query}"</p>
                              {searchMode === 'quick' && (
                                <Button 
                                  onClick={handleDeepSearch} 
                                  variant="outline" 
                                  className="mt-4"
                                  disabled={isDeepSearching}
                                >
                                  {isDeepSearching ? 'Searching deeply...' : 'Try Deep Search'}
                                </Button>
                              )}
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="users">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Users className="h-5 w-5" /> People
                          </h2>
                          {results.users.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                              {results.users.map((user) => (
                                <UserResultItem
                                  key={user.id}
                                  user={user}
                                  onClick={() => {}}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No people found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                      </>
                    )}
                  </div>
                </Tabs>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Enter a search term to find people, places, products and more</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Search;
