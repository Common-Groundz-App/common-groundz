
import React, { useState, useEffect } from 'react';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { UserDirectoryList } from '@/components/explore/UserDirectoryList';
import { cn } from '@/lib/utils';
import { Filter, Users, Search, Film, Book, MapPin, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useUnifiedSearch } from '@/hooks/use-unified-search';
import { UserResultItem } from '@/components/search/UserResultItem';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { ReviewResultItem } from '@/components/search/ReviewResultItem';
import { RecommendationResultItem } from '@/components/search/RecommendationResultItem';
import { ProductResultItem } from '@/components/search/ProductResultItem';
import { FeaturedEntities } from '@/components/explore/FeaturedEntities';
import { CategoryHighlights } from '@/components/explore/CategoryHighlights';
import { ProductCard } from '@/components/explore/ProductCard';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { supabase } from '@/integrations/supabase/client';

const Explore = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const { 
    results, 
    isLoading, 
    error, 
    hasResults 
  } = useUnifiedSearch(searchQuery);

  // Function to search products directly for the Products tab
  const searchProducts = async (query: string) => {
    if (!query || query.length < 2) {
      setProductResults([]);
      return;
    }
    setIsLoadingProducts(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-products', {
        body: { query }
      });
      
      if (error) throw error;
      
      setProductResults(data.results || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Effect to search products when in the Products tab
  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchProducts(searchQuery);
    }
  }, [searchQuery]);
  
  const getInitialActiveTab = () => {
    return 'Explore';
  };

  if (!user) {
    return <div>Loading...</div>;
  }

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

  const handleResultClick = () => {
    setSearchQuery('');
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
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 max-h-[70vh] overflow-y-auto">
                  {isLoading && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Searching...</p>
                    </div>
                  )}
                  
                  {error && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                  
                  {!isLoading && !error && !hasResults && searchQuery.length >= 2 && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">No results found</p>
                    </div>
                  )}
                  
                  {!isLoading && !error && (
                    <>
                      {results.products && results.products.length > 0 && (
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            Products
                          </div>
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
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            Places & Things
                          </div>
                          {results.entities.map((entity) => (
                            <EntityResultItem
                              key={entity.id}
                              entity={entity}
                              onClick={handleResultClick}
                            />
                          ))}
                        </div>
                      )}
                      
                      {results.users.length > 0 && (
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            People
                          </div>
                          {results.users.map((user) => (
                            <UserResultItem
                              key={user.id}
                              user={user}
                              onClick={handleResultClick}
                            />
                          ))}
                        </div>
                      )}
                      
                      {results.reviews.length > 0 && (
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            Reviews
                          </div>
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
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            Recommendations
                          </div>
                          {results.recommendations.map((recommendation) => (
                            <RecommendationResultItem
                              key={recommendation.id}
                              recommendation={recommendation}
                              onClick={handleResultClick}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
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
                <div>
                  {isLoadingProducts && (
                    <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-[300px] bg-muted rounded-lg animate-pulse" />
                      ))}
                    </div>
                  )}
                  
                  {!isLoadingProducts && productResults.length === 0 && searchQuery.length >= 2 && (
                    <div className="mt-4 p-8 text-center">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-medium mb-2">No products found</h3>
                      <p className="text-sm text-muted-foreground">
                        Try searching for specific product names, categories, or brands
                      </p>
                    </div>
                  )}
                  
                  {!isLoadingProducts && productResults.length === 0 && searchQuery.length < 2 && (
                    <div className="mt-4 p-8 text-center">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-medium mb-2">Discover Products</h3>
                      <p className="text-sm text-muted-foreground">
                        Search for products to compare prices and find the best deals
                      </p>
                    </div>
                  )}
                  
                  {!isLoadingProducts && productResults.length > 0 && (
                    <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                      {productResults.map((product, index) => (
                        <ProductCard 
                          key={`${product.api_source}-${product.api_ref || index}`}
                          product={product} 
                        />
                      ))}
                    </div>
                  )}
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
