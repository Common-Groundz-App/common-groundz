
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
import { useLocalSuggestions } from '@/hooks/use-local-suggestions';
import { toast } from '@/components/ui/use-toast';

const Explore = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Use local suggestions for search dropdown - no API calls during typing
  const { 
    suggestions, 
    isLoading: isLoadingSuggestions, 
    error: suggestionsError 
  } = useLocalSuggestions(searchQuery);

  // Local search only during typing - no external API calls
  const { 
    results: localResults, 
    isLoading: isLoadingLocalResults,
    error: localResultsError
  } = useUnifiedSearch(searchQuery, { skipProductSearch: true });

  // Handle explicit search submission - redirect to product search page
  const handleSearchSubmit = () => {
    if (searchQuery.trim().length >= 2) {
      console.log(`🎯 Frontend: Redirecting to product search for: "${searchQuery}"`);
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      navigate(`/search/products/${encodedQuery}`);
    }
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };
  
  const getInitialActiveTab = () => {
    return 'Explore';
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const productSuggestions = suggestions.filter(s => s.type === 'product');
  
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
                  onKeyDown={handleKeyDown}
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {searchQuery && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mr-1"
                    onClick={handleSearchSubmit}
                  >
                    Search
                  </Button>
                )}
              </div>
              
              {searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 max-h-[70vh] overflow-y-auto">
                  {isLoadingSuggestions && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">Loading suggestions...</p>
                    </div>
                  )}
                  
                  {suggestionsError && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-destructive">{suggestionsError}</p>
                    </div>
                  )}
                  
                  {!isLoadingSuggestions && !suggestionsError && suggestions.length === 0 && searchQuery.length >= 2 && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">No local suggestions found. Press Enter or Search to search online.</p>
                    </div>
                  )}
                  
                  {!isLoadingSuggestions && !suggestionsError && suggestions.length > 0 && (
                    <>
                      {productSuggestions.length > 0 && (
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            Products
                          </div>
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
                              query={searchQuery}
                              onClick={handleResultClick}
                            />
                          ))}
                        </div>
                      )}
                      
                      {suggestions.filter(s => s.type === 'entity').length > 0 && (
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            Places & Things
                          </div>
                          {suggestions.filter(s => s.type === 'entity').map((suggestion) => (
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
                      
                      {suggestions.filter(s => s.type === 'user').length > 0 && (
                        <div className="border-b last:border-b-0">
                          <div className="px-4 py-1 text-xs font-medium text-muted-foreground bg-muted/20">
                            People
                          </div>
                          {suggestions.filter(s => s.type === 'user').map((suggestion) => (
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
                  
                  {searchQuery.length >= 2 && (
                    <div className="p-3 text-center border-t">
                      <button 
                        className="text-sm text-primary hover:underline flex items-center justify-center w-full"
                        onClick={handleSearchSubmit}
                      >
                        <Search className="w-3 h-3 mr-1" />
                        Search for "{searchQuery}"
                      </button>
                    </div>
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
                        onClick={handleSearchSubmit}
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
