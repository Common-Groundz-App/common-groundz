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
import { UserDirectoryList } from '@/components/explore/UserDirectoryList';
import { Filter, Users, Search, Film, BookOpen, MapPin, ShoppingBag, Loader2, ChevronDown, ChevronUp, Star, Utensils, Menu as MenuIcon, X, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useEnhancedRealtimeSearch } from '@/hooks/use-enhanced-realtime-search';
import { UserResultItem } from '@/components/search/UserResultItem';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { FeaturedEntities } from '@/components/explore/FeaturedEntities';
import { CategoryHighlights } from '@/components/explore/CategoryHighlights';
import { TrendingHashtags } from '@/components/hashtag/TrendingHashtags';
import { enhancedExploreService } from '@/services/enhancedExploreService';
import { getTrendingHashtags, HashtagWithCount } from '@/services/hashtagService';

import { CreateEntityDialog } from '@/components/admin/CreateEntityDialog';
import { useToast } from '@/hooks/use-toast';

const Explore = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('featured');
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);
  const navigate = useNavigate();

  // Create entity dialog state
  const [showCreateEntityDialog, setShowCreateEntityDialog] = useState(false);
  const [createEntityQuery, setCreateEntityQuery] = useState('');
  
  const { toast } = useToast();

  // Page-level loading state for entities
  const [isProcessingEntity, setIsProcessingEntity] = useState(false);
  const [processingEntityName, setProcessingEntityName] = useState('');
  const [processingMessage, setProcessingMessage] = useState('');
  
  // Dropdown state for search
  const [showDropdown, setShowDropdown] = useState(true); // Always show when shouldShowDropdown is true
  
  // Trending hashtags state
  const [trendingHashtags, setTrendingHashtags] = useState<HashtagWithCount[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Load trending hashtags
  useEffect(() => {
    const loadTrendingHashtags = async () => {
      try {
        setTrendingLoading(true);
        const hashtags = await getTrendingHashtags(8);
        setTrendingHashtags(hashtags);
      } catch (error) {
        console.error('Failed to load trending hashtags:', error);
      } finally {
        setTrendingLoading(false);
      }
    };

    loadTrendingHashtags();
  }, []);

  // Use the enhanced realtime search hook
  const { 
    results, 
    isLoading, 
    loadingStates, 
    error,
    showAllResults,
    toggleShowAll,
    searchMode,
    refetch
  } = useEnhancedRealtimeSearch(searchQuery, { mode: 'quick' });

  const handleResultClick = async (entityId?: string, entityType?: string) => {
    // Start dropdown closing animation
    setIsDropdownClosing(true);
    
    // Track interaction if we have entity details
    if (entityId && entityType && user?.id) {
      await enhancedExploreService.trackUserInteraction(
        user.id,
        entityId,
        entityType,
        entityType, // Using type as category
        'click'
      );
    }
    
    // Clear search and close dropdown after animation
    setTimeout(() => {
      setSearchQuery('');
      setIsDropdownClosing(false);
    }, 300);
  };

  const handleProcessingStart = (entityName: string, message: string) => {
    setIsProcessingEntity(true);
    setProcessingEntityName(entityName);
    setProcessingMessage(message);
  };

  const handleProcessingUpdate = (message: string) => {
    setProcessingMessage(message);
  };

  const handleProcessingEnd = () => {
    setIsProcessingEntity(false);
    setProcessingEntityName('');
    setProcessingMessage('');
  };

  const handleCancelProcessing = () => {
    setIsProcessingEntity(false);
    setProcessingEntityName('');
    setProcessingMessage('');
    // Clear search and close dropdown
    setSearchQuery('');
    setIsDropdownClosing(false);
    // Navigate back to explore page
    navigate('/explore');
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
  
  // ... keep existing code (tabItems definition)
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
  const hasExternalResults = results.categorized.books.length > 0 ||
                            results.categorized.movies.length > 0 ||
                            results.categorized.places.length > 0;
  const hasHashtagResults = results.hashtags?.length > 0;

  const renderSectionHeader = (title: string, count: number, categoryKey?: keyof typeof showAllResults) => (
    <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20 flex items-center justify-between">
      <span>{title} ({count})</span>
      <div className="flex items-center gap-2">
        {categoryKey && count > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-brand-orange font-semibold hover:text-brand-orange/80"
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
    </div>
  );

  // Show dropdown when user has typed at least 1 character and not closing
  const shouldShowDropdown = searchQuery && searchQuery.trim().length >= 1 && !isDropdownClosing && showDropdown;

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
        <div className="hidden xl:block">
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4 pl-4"
          />
        </div>
        
        <div className="flex-1 pt-16 xl:pt-0 xl:ml-64 min-w-0">
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
            
            <div className="relative mb-6 overflow-visible">
              <div className="flex items-center border rounded-lg overflow-hidden bg-background min-w-0">
                <div className="pl-3 text-muted-foreground shrink-0">
                  <Search size={18} />
                </div>
                <div className="relative flex-1 min-w-0">
                  <Input
                    type="text"
                    placeholder="Search for people, places, food, products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        handleCancelProcessing();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                      type="button"
                      aria-label="Clear search query"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
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
              
              {/* Enhanced Search Results Dropdown with smooth closing animation */}
              {shouldShowDropdown && (
                <div className={`absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl z-[60] max-h-[70vh] overflow-y-auto transition-all duration-300 ${
                  isDropdownClosing ? 'opacity-0 transform scale-95 translate-y-2' : 'opacity-100 transform scale-100 translate-y-0'
                }`}>
                  
                  {/* Loading State */}
                  {isLoading && (
                    <div className="p-3 text-center border-b bg-background">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching with enhanced reliability...</span>
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {error && (
                    <div className="p-3 text-center border-b bg-yellow-50 dark:bg-yellow-900/20">
                      <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Already on Groundz - Local Results */}
                  {results.entities.length > 0 && (
                    <div className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader('✨ Already on Groundz', results.entities.length, 'entities')}
                      {(showAllResults.entities ? results.entities : results.entities.slice(0, 3)).map((entity) => (
                        <EntityResultItem
                          key={entity.id}
                          entity={entity}
                          onClick={() => handleResultClick(entity.id, entity.type)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Books from External APIs */}
                  {results.categorized?.books?.length > 0 && (
                    <div className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader('📚 Books', results.categorized.books.length, 'books')}
                      {(showAllResults.books ? results.categorized.books : results.categorized.books.slice(0, 3)).map((book, index) => (
                        <SearchResultHandler
                          key={`${book.api_source}-${book.api_ref || index}`}
                          result={book}
                          query={searchQuery}
                          onClose={() => handleResultClick()}
                          isProcessing={isProcessingEntity}
                          onProcessingStart={handleProcessingStart}
                          onProcessingUpdate={handleProcessingUpdate}
                          onProcessingEnd={handleProcessingEnd}
                          useExternalOverlay={true}
                        />
                      ))}
                    </div>
                  )}

                  {/* Movies from External APIs */}
                  {results.categorized?.movies?.length > 0 && (
                    <div className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader('🎬 Movies', results.categorized.movies.length, 'movies')}
                      {(showAllResults.movies ? results.categorized.movies : results.categorized.movies.slice(0, 3)).map((movie, index) => (
                        <SearchResultHandler
                          key={`${movie.api_source}-${movie.api_ref || index}`}
                          result={movie}
                          query={searchQuery}
                          onClose={() => handleResultClick()}
                          isProcessing={isProcessingEntity}
                          onProcessingStart={handleProcessingStart}
                          onProcessingUpdate={handleProcessingUpdate}
                          onProcessingEnd={handleProcessingEnd}
                          useExternalOverlay={true}
                        />
                      ))}
                    </div>
                  )}

                  {/* Places from External APIs */}
                  {results.categorized?.places?.length > 0 && (
                    <div className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader('📍 Places', results.categorized.places.length, 'places')}
                      {(showAllResults.places ? results.categorized.places : results.categorized.places.slice(0, 3)).map((place, index) => (
                        <SearchResultHandler
                          key={`${place.api_source}-${place.api_ref || index}`}
                          result={place}
                          query={searchQuery}
                          onClose={() => handleResultClick()}
                          isProcessing={isProcessingEntity}
                          onProcessingStart={handleProcessingStart}
                          onProcessingUpdate={handleProcessingUpdate}
                          onProcessingEnd={handleProcessingEnd}
                          useExternalOverlay={true}
                        />
                      ))}
                    </div>
                  )}

                  {/* Hashtags */}
                  {results.hashtags?.length > 0 && (
                    <div className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader('# Hashtags', results.hashtags.length, 'hashtags')}
                      {(showAllResults.hashtags ? results.hashtags : results.hashtags.slice(0, 3)).map((hashtag) => (
                        <div
                          key={hashtag.id}
                          onClick={() => {
                            navigate(`/t/${hashtag.name_norm}`);
                            handleResultClick();
                          }}
                          className="flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-primary font-medium">#{hashtag.name_original}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {hashtag.post_count} posts
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* People */}
                  {results.users.length > 0 && (
                    <div className="border-b last:border-b-0 bg-background">
                      {renderSectionHeader('👥 People', results.users.length, 'users')}
                      {(showAllResults.users ? results.users : results.users.slice(0, 3)).map((user) => (
                        <UserResultItem
                          key={user.id}
                          user={user}
                          onClick={() => handleResultClick()}
                        />
                      ))}
                    </div>
                  )}

              {/* Add Entity CTA */}
              {searchQuery.length >= 1 && (
                <div className="p-3 text-center bg-muted/30 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Couldn't find "<span className="font-medium text-foreground">{searchQuery}</span>"?
                  </p>
                  <button 
                    className="text-sm text-brand-orange hover:text-brand-orange/80 font-medium flex items-center justify-center w-full"
                    onClick={() => {
                      setCreateEntityQuery(searchQuery);
                      setShowCreateEntityDialog(true);
                      setShowDropdown(false);
                      setIsDropdownClosing(true);
                      setTimeout(() => setIsDropdownClosing(false), 300);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Entity
                  </button>
                </div>
              )}
                </div>
              )}
            </div>
            
            {/* Navigation - Responsive */}
            {/* ... keep existing code (navigation tabs) */}
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
                  {/* Trending Hashtags Section */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      🔥 Trending Hashtags
                    </h2>
                    <TrendingHashtags 
                      hashtags={trendingHashtags}
                      isLoading={trendingLoading}
                      displayMode="grid"
                      limit={6}
                      showGrowth={true}
                    />
                  </div>
                  
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
                <CategoryHighlights entityType="product" />
              </TabsContent>
              
              <TabsContent value="people">
                <UserDirectoryList sortOption={sortOption} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>

      {/* Full-Screen Loading Overlay - Rendered at Page Level */}
      {isProcessingEntity && (
        <div className="fixed inset-0 z-[100] pointer-events-auto">
          {/* Full-screen white background */}
          <div className="absolute inset-0 bg-white" />
          
          {/* Centered loading toast */}
          <div className="flex items-center justify-center h-full">
            <div className="bg-white border rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full animate-fade-in relative">
              {/* Cancel button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCancelProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="flex flex-col items-center gap-6 pt-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-r-primary/40 animate-spin animation-delay-150" />
                </div>
                <div className="text-center space-y-3">
                  <h3 className="font-semibold text-lg text-foreground">{processingEntityName}</h3>
                  <div className="flex items-center justify-center">
                    <span className="text-center leading-relaxed animate-fade-in text-sm text-muted-foreground px-4">
                      {processingMessage || '✨ Processing your selection...'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/80">
                    Click X to cancel
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Entity Dialog */}
      <CreateEntityDialog
        open={showCreateEntityDialog}
        onOpenChange={(open) => {
          setShowCreateEntityDialog(open);
          if (!open) {
            setShowDropdown(true);
          }
        }}
        onEntityCreated={() => {
          refetch();
          toast({
            title: "Entity created",
            description: "Your entity has been added successfully!",
          });
        }}
        variant="user"
        prefillName={createEntityQuery}
        showPreviewTab={false}
      />
    </div>
  );
};

export default Explore;
