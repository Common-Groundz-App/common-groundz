
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
import { Filter, Users, Search, MapPin, Coffee, ShoppingBag, Film } from 'lucide-react';
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
import { FeaturedEntities } from '@/components/explore/FeaturedEntities';
import { TrendingReviews } from '@/components/explore/TrendingReviews';
import { PopularRecommendations } from '@/components/explore/PopularRecommendations';
import { CategoryHighlights } from '@/components/explore/CategoryHighlights';
import { EntityTypeString } from '@/hooks/feed/api/types';

const Explore = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const { 
    results, 
    isLoading, 
    error, 
    hasResults,
    defaultUsers,
  } = useUnifiedSearch(searchQuery);
  
  const getInitialActiveTab = () => {
    return 'Explore';
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const tabItems = [
    {
      value: "people",
      label: "People",
      icon: Users
    },
    {
      value: "places",
      label: "Places",
      icon: MapPin
    },
    {
      value: "food",
      label: "Food",
      icon: Coffee
    },
    {
      value: "products",
      label: "Products",
      icon: ShoppingBag
    },
    {
      value: "entertainment",
      label: "Entertainment",
      icon: Film
    }
  ];

  const handleResultClick = () => {
    setSearchQuery('');
  };

  // Determine if we should show search results or default content
  const showingSearchResults = searchQuery.length > 0;

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
            
            {showingSearchResults ? (
              // Show search results when searching
              <TubelightTabs defaultValue="people" items={[tabItems[0]]}>
                <TabsContent value="people">
                  <UserDirectoryList sortOption={sortOption} />
                </TabsContent>
              </TubelightTabs>
            ) : (
              // Show enhanced explore content when not searching
              <TubelightTabs defaultValue="people" items={tabItems}>
                <TabsContent value="people">
                  <UserDirectoryList sortOption={sortOption} />
                </TabsContent>
                
                <TabsContent value="places">
                  <CategoryHighlights category="place" />
                  <FeaturedEntities type="place" />
                </TabsContent>
                
                <TabsContent value="food">
                  <CategoryHighlights category="food" />
                  <FeaturedEntities type="food" />
                </TabsContent>
                
                <TabsContent value="products">
                  <CategoryHighlights category="product" />
                  <FeaturedEntities type="product" />
                </TabsContent>
                
                <TabsContent value="entertainment">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <FeaturedEntities type="movie" title="Movies" />
                    <FeaturedEntities type="tv" title="TV Shows" />
                  </div>
                </TabsContent>
              </TubelightTabs>
            )}
            
            {!showingSearchResults && (
              <div className="mt-12 space-y-12">
                <TrendingReviews />
                <PopularRecommendations />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Explore;
