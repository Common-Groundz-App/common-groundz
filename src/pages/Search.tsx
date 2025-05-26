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
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { cn } from '@/lib/utils';
import { Search as SearchIcon, Users, MapPin, Film, Book, ShoppingBag, AlertCircle, Loader2 } from 'lucide-react';
import { useUnifiedSearch } from '@/hooks/use-unified-search';

const Search = () => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(query);
  const [activeTab, setActiveTab] = useState('all');

  // Use the updated unified search hook
  const { results, isLoading, error } = useUnifiedSearch(query);

  // Update the URL when search query changes
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      setSearchParams({ q: searchQuery });
    }
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
                  onValueChange={setActiveTab}
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
                          {results.products.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5" /> Products & Items
                              </h2>
                              <p className="text-sm text-muted-foreground mb-4">
                                Click any result to create an entity and start reviewing!
                              </p>
                              <div className="space-y-2">
                                {results.products.slice(0, 5).map((product, index) => (
                                  <SearchResultHandler
                                    key={`${product.api_source}-${product.api_ref || index}`}
                                    result={product}
                                    query={query}
                                  />
                                ))}
                              </div>
                              {results.products.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setActiveTab('products')}
                                  >
                                    View all {results.products.length} items
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Places section */}
                          {results.entities.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <MapPin className="h-5 w-5" /> Places & Things
                              </h2>
                              <div className="border rounded-md overflow-hidden">
                                {results.entities.slice(0, 5).map((entity) => (
                                  <EntityResultItem
                                    key={entity.id}
                                    entity={entity}
                                    onClick={() => {}}
                                  />
                                ))}
                              </div>
                              {results.entities.length > 5 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setActiveTab('entities')}
                                  >
                                    View all {results.entities.length} places & things
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
                                    onClick={() => setActiveTab('users')}
                                  >
                                    View all {results.users.length} people
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Reviews section */}
                          {results.reviews.length > 0 && (
                            <div className="mb-8">
                              <h2 className="text-xl font-semibold mb-4">Reviews</h2>
                              <div className="border rounded-md overflow-hidden">
                                {results.reviews.slice(0, 3).map((review) => (
                                  <ReviewResultItem
                                    key={review.id}
                                    review={review}
                                    onClick={() => {}}
                                  />
                                ))}
                              </div>
                              {results.reviews.length > 3 && (
                                <div className="mt-4 text-center">
                                  <Button 
                                    variant="outline"
                                    onClick={() => setActiveTab('reviews')}
                                  >
                                    View all {results.reviews.length} reviews
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* No results message */}
                          {!results.products.length && 
                           !results.entities.length && 
                           !results.users.length && 
                           !results.reviews.length && 
                           !results.recommendations.length && (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No results found for "{query}"</p>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="products">
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5" /> Products & Items
                          </h2>
                          <p className="text-sm text-muted-foreground mb-4">
                            Click any result to create an entity and start reviewing!
                          </p>
                          {results.products.length > 0 ? (
                            <div className="space-y-2">
                              {results.products.map((product, index) => (
                                <SearchResultHandler
                                  key={`${product.api_source}-${product.api_ref || index}`}
                                  result={product}
                                  query={query}
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
                          {results.entities.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                              {results.entities.map((entity) => (
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
                        
                        <TabsContent value="reviews">
                          <h2 className="text-xl font-semibold mb-4">Reviews</h2>
                          {results.reviews.length > 0 ? (
                            <div className="border rounded-md overflow-hidden">
                              {results.reviews.map((review) => (
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
