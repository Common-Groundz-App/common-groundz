
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
import { Filter, Users, Search, Book, Movie, Place, Food, Product } from 'lucide-react';
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
import { CategoryHighlights } from '@/components/explore/CategoryHighlights';
import { EntityTypeString } from '@/hooks/feed/api/types';

const Explore = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('explore');
  const { 
    results, 
    isLoading, 
    error, 
    hasResults 
  } = useUnifiedSearch(searchQuery);
  
  const getInitialActiveTab = () => {
    return 'Explore';
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const exploreTabItems = [
    {
      value: "explore",
      label: "Explore",
      icon: Search
    },
    {
      value: "people",
      label: "People",
      icon: Users
    },
    {
      value: "places",
      label: "Places",
      icon: Place
    },
    {
      value: "food",
      label: "Food",
      icon: Food
    },
    {
      value: "movies",
      label: "Movies",
      icon: Movie
    },
    {
      value: "books",
      label: "Books",
      icon: Book
    },
    {
      value: "products",
      label: "Products",
      icon: Product
    }
  ];

  const handleResultClick = () => {
    setSearchQuery('');
  };

  const getEntityTypeForTab = (tab: string): EntityTypeString => {
    switch (tab) {
      case 'places': return 'place';
      case 'food': return 'food';
      case 'movies': return 'movie';
      case 'books': return 'book';
      case 'products': return 'product';
      default: return 'place';
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
            
            <TubelightTabs 
              defaultValue={activeTab} 
              items={exploreTabItems}
              onValueChange={(value) => setActiveTab(value)}
            >
              <TabsContent value="explore">
                <div className="space-y-8">
                  <FeaturedEntities 
                    type="place"
                    title="Popular Places"
                    limit={5}
                  />
                  
                  <CategoryHighlights 
                    type="food"
                    limit={3}
                  />
                  
                  <FeaturedEntities
                    type="movie"
                    title="Popular Movies"
                    limit={5}
                  />
                  
                  <CategoryHighlights
                    type="book"
                    limit={3}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="people">
                <UserDirectoryList sortOption={sortOption} />
              </TabsContent>
              
              {['places', 'food', 'movies', 'books', 'products'].map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <div className="space-y-8">
                    <FeaturedEntities 
                      type={getEntityTypeForTab(tab)}
                      title={`Popular ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
                      limit={5}
                    />
                    
                    <CategoryHighlights 
                      type={getEntityTypeForTab(tab)}
                      limit={3}
                    />
                  </div>
                </TabsContent>
              ))}
            </TubelightTabs>
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Explore;
