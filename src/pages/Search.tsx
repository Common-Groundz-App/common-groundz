
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
import { ProductCard } from '@/components/explore/ProductCard';
import { cn } from '@/lib/utils';
import { Search as SearchIcon, Users, MapPin, Film, Book, ShoppingBag, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProductSearchResult, EntitySearchResult, RecommendationSearchResult, ReviewSearchResult, SearchResult as UserSearchResult } from '@/hooks/use-unified-search';

const Search = () => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(query);
  const [searchResults, setSearchResults] = useState<{
    products: ProductSearchResult[];
    entities: EntitySearchResult[];
    reviews: ReviewSearchResult[];
    recommendations: RecommendationSearchResult[];
    users: UserSearchResult[];
  }>({
    products: [],
    entities: [],
    reviews: [],
    recommendations: [],
    users: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Function to perform the search
  const performSearch = async (q: string) => {
    if (!q || q.trim().length < 2) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-all', {
        body: { 
          query: q,
          limit: 20,
          type: activeTab === 'all' ? 'all' : activeTab
        }
      });
      
      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }
      
      setSearchResults({
        products: data?.products || [],
        entities: data?.entities || [],
        reviews: data?.reviews || [],
        recommendations: data?.recommendations || [],
        users: data?.users || []
      });
      
    } catch (err) {
      console.error('Error performing search:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setSearchResults({
        products: [],
        entities: [],
        reviews: [],
        recommendations: [],
        users: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update the URL when search query changes
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      setSearchParams({ q: searchQuery });
    }
  };

  // Perform search when the query parameter changes
  useEffect(() => {
    if (query && query.trim().length >= 2) {
      performSearch(query);
    }
  }, [query, activeTab]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    performSearch(query);
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
            
            {query ? (
              <>
                <Tabs 
                  defaultValue="all" 
                  value={activeTab}
                  onValueChange={handleTabChange}
                  className="mb-6"
                >
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="entities">Places</TabsTrigger>
                    <TabsTrigger value="reviews">Reviews</TabsTrigger>
                    <TabsTrigger value="users">People</TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-6">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground">Searching...</p>
                      </div>
                    ) : error ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
                        <p className="text-muted-foreground">{error}</p>
                      </div>
                    ) : (
                      <>
                        <TabsContent value="all">
                          {/* Products section */}
                          {searchResults.products.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5" /> Products
                              </h2>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {searchResults.products.slice(0, 3).map((product, index) => (
                                  <ProductCard 
                                    key={`${product.api_source}-${product.api_ref || index}`}
                                    product={product} 
                                  />
                                ))}
                              </div>
                              {searchResults.products.length > 3 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setActiveTab('products')}
                                  >
                                    View all {searchResults.products.length} products
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Places section */}
                          {searchResults.entities.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <MapPin className="h-5 w-5" /> Places & Things
                              </h2>
                              <div className="border rounded-md overflow-hidden">
                                {searchResults.entities.slice(0, 5).map((entity) => (
                                  <EntityResultItem
                                    key={entity.id}
                                    entity={entity}
                                    onClick={() => {}}
                                  />
                                ))}
                              </div>
                              {searchResults.entities.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setActiveTab('entities')}
                                  >
                                    View all {searchResults.entities.length} places & things
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* People section */}
                          {searchResults.users.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5" /> People
                              </h2>
                              <div className="border rounded-md overflow-hidden">
                                {searchResults.users.slice(0, 5).map((user) => (
                                  <UserResultItem
                                    key={user.id}
                                    user={user}
                                    onClick={() => {}}
                                  />
                                ))}
                              </div>
                              {searchResults.users.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setActiveTab('users')}
                                  >
                                    View all {searchResults.users.length} people
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Reviews section */}
                          {searchResults.reviews.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4">Reviews</h2>
                              <div className="border rounded-md overflow-hidden">
                                {searchResults.reviews.slice(0, 3).map((review) => (
                                  <ReviewResultItem
                                    key={review.id}
                                    review={review}
                                    onClick={() => {}}
                                  />
                                ))}
                              </div>
                              {searchResults.reviews.length > 3 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setActiveTab('reviews')}
                                  >
                                    View all {searchResults.reviews.length} reviews
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* No results message */}
                          {!searchResults.products.length && 
                           !searchResults.entities.length && 
                           !searchResults.users.length && 
                           !searchResults.reviews.length && 
                           !searchResults.recommendations.length && (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No results found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="products">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5" /> Products
                          </h2>
                          {searchResults.products.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {searchResults.products.map((product, index) => (
                                <ProductCard 
                                  key={`${product.api_source}-${product.api_ref || index}`}
                                  product={product} 
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No products found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="entities">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <MapPin className="h-5 w-5" /> Places & Things
                          </h2>
                          {searchResults.entities.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                              {searchResults.entities.map((entity) => (
                                <EntityResultItem
                                  key={entity.id}
                                  entity={entity}
                                  onClick={() => {}}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No places or things found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="users">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Users className="h-5 w-5" /> People
                          </h2>
                          {searchResults.users.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                              {searchResults.users.map((user) => (
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
                        
                        <TabsContent value="reviews">
                          <h2 className="text-xl font-semibold mb-4">Reviews</h2>
                          {searchResults.reviews.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                              {searchResults.reviews.map((review) => (
                                <ReviewResultItem
                                  key={review.id}
                                  review={review}
                                  onClick={() => {}}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No reviews found for "{query}"</p>
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
