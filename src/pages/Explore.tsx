import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { PillTabs } from '@/components/ui/pill-tabs';
import { MenuItem, MenuContainer } from '@/components/ui/fluid-menu';
import { UserDirectoryList } from '@/components/explore/UserDirectoryList';
import { Filter, Users, Search, Film, BookOpen, MapPin, ShoppingBag, Loader2, ChevronDown, ChevronUp, Star, Utensils, Menu as MenuIcon, X, AlertCircle } from 'lucide-react';
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
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { FeaturedEntities } from '@/components/explore/FeaturedEntities';
import { CategoryHighlights } from '@/components/explore/CategoryHighlights';

const Explore = () => {
  const { user } = useAuth();
  // Keep useIsMobile only for search logic, not layout rendering
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('featured');
  const navigate = useNavigate();

  // Use the unified search hook
  const { 
    results, 
    isLoading, 
    error
  } = useUnifiedSearch(searchQuery, { skipProductSearch: false });

  const handleResultClick = () => {
    setSearchQuery('');
  };

  const handleComplexProductSearch = () => {
    if (searchQuery.trim().length >= 2) {
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      navigate(`/search?q=${encodedQuery}&mode=quick`);
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
  
  const tabItems = [
    {
      value: "featured",
      label: "Featured",
      icon: Star,
      emoji: "⭐"
    },
    {
      value: "places",
      label: "Places",
      icon: MapPin,
      emoji: "📍"
    },
    {
      value: "movies",
      label: "Movies",
      icon: Film,
      emoji: "🎬"
    },
    {
      value: "books",
      label: "Books",
      icon: BookOpen,
      emoji: "📚"
    },
    {
      value: "food",
      label: "Food",
      icon: Utensils,
      emoji: "🍽️"
    },
    {
      value: "products",
      label: "Products",
      icon: ShoppingBag,
      emoji: "🛍️"
    },
    {
      value: "people",
      label: "People",
      icon: Users,
      emoji: "👥"
    }
  ];

  const hasLocalResults = results.entities.length > 0 || results.users.length > 0;
  const hasExternalResults = results.products.length > 0;

  // Show dropdown when user has typed at least 1 character
  const shouldShowDropdown = searchQuery && searchQuery.trim().length >= 1;

  console.log('🔍 Search Debug:', {
    searchQuery,
    shouldShowDropdown,
    isLoading,
    hasLocalResults,
    hasExternalResults,
    error,
    results
  });

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Mobile Header - Only show on mobile screens */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-start">
          <Logo size="sm" />
        </div>
      </div>
      
      <div className="flex flex-1 overflow-x-hidden">
        {/* Desktop Sidebar - Only show on xl+ screens */}
        <div className="hidden xl:block fixed left-0 top-0 h-screen">
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="h-full"
          />
        </div>
        
        <div className="flex-1 pt-16 xl:pt-0 xl:pl-64 min-w-0">
          <div className="container max-w-4xl mx-auto p-4 md:p-8 min-w-0">
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
            
            <div className="relative mb-6 overflow-hidden">
              <div className="flex items-center border rounded-lg overflow-hidden bg-background min-w-0">
                <div className="pl-3 text-muted-foreground shrink-0">
                  <Search size={18} />
                </div>
                <Input
                  type="text"
                  placeholder="Search for people, places, food, products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0"
                />
                {searchQuery && (
                  <Button 
                    variant="default" 
                    size="sm"
                    className="mr-1 bg-brand-orange hover:bg-brand-orange/90 shrink-0 max-[500px]:text-xs max-[500px]:px-2"
                    onClick={handleComplexProductSearch}
                  >
                    <span className="max-[400px]:hidden">Search More</span>
                    <span className="min-[401px]:hidden">More</span>
                  </Button>
                )}
              </div>
              
              {/* Search Results Dropdown - Always show when user types */}
              {shouldShowDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 max-h-[70vh] overflow-y-auto">
                  
                  {/* Loading State */}
                  {isLoading && (
                    <div className="p-3 text-center border-b">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching...</span>
                      </div>
                    </div>
                  )}

                  {/* Error State - Show but don't block results */}
                  {error && (
                    <div className="p-3 text-center border-b bg-yellow-50">
                      <div className="flex items-center justify-center gap-2 text-sm text-yellow-700">
                        <AlertCircle className="w-4 h-4" />
                        <span>Some search sources are unavailable</span>
                      </div>
                      <p className="text-xs mt-1 text-yellow-600">Showing available results below</p>
                    </div>
                  )}
                  
                  {/* Already on Groundz - Local Results (Priority Section) */}
                  {results.entities.length > 0 && (
                    <div className="border-b last:border-b-0">
                      <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                        ✨ Already on Groundz ({results.entities.length})
                      </div>
                      {results.entities.slice(0, 3).map((entity) => (
                        <EntityResultItem
                          key={entity.id}
                          entity={entity}
                          onClick={handleResultClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* External Products */}
                  {results.products.length > 0 && (
                    <div className="border-b last:border-b-0">
                      <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                        🔍 External Results ({results.products.length})
                      </div>
                      {results.products.slice(0, 3).map((product, index) => (
                        <SearchResultHandler
                          key={`${product.api_source}-${product.api_ref || index}`}
                          result={product}
                          query={searchQuery}
                          onClose={handleResultClick}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* People */}
                  {results.users.length > 0 && (
                    <div className="border-b last:border-b-0">
                      <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                        👥 People ({results.users.length})
                      </div>
                      {results.users.slice(0, 3).map((user) => (
                        <UserResultItem
                          key={user.id}
                          user={user}
                          onClick={handleResultClick}
                        />
                      ))}
                    </div>
                  )}

                  {/* Complex Product Search Option - Always show */}
                  {searchQuery.length >= 2 && (
                    <div className="p-3 text-center border-t">
                      <button 
                        className="text-sm text-primary hover:underline flex items-center justify-center w-full"
                        onClick={handleComplexProductSearch}
                      >
                        <Search className="w-3 h-3 mr-1" />
                        Search for "{searchQuery}" in more sources
                      </button>
                    </div>
                  )}

                  {/* No Results State - Only show when not loading and no results */}
                  {!hasLocalResults && !hasExternalResults && !isLoading && (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">No immediate results found</p>
                      <button 
                        className="text-sm text-primary hover:underline"
                        onClick={handleComplexProductSearch}
                      >
                        Try searching in more sources
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Navigation - Responsive */}
            <div className="overflow-x-hidden mb-6">
              {/* Pill Navigation for screens < 630px */}
              <div className="max-[629px]:block min-[630px]:hidden">
                <PillTabs 
                  items={tabItems}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>

              {/* TubelightTabs for screens >= 630px */}
              <div className="max-[629px]:hidden">
                <TubelightTabs 
                  defaultValue={activeTab} 
                  items={tabItems}
                  onValueChange={setActiveTab}
                >
                  {/* Tab content will be rendered below */}
                </TubelightTabs>
              </div>
            </div>

            {/* Tab Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                    <div className="relative flex-1 max-w-md min-w-0">
                      <Input
                        type="text"
                        placeholder="Search for products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pr-20 min-w-0"
                      />
                      <Button 
                        className="absolute right-0 top-0 rounded-l-none bg-brand-orange hover:bg-brand-orange/90 shrink-0"
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
            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation - Only show on mobile screens */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default Explore;
