import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { PillTabs } from '@/components/ui/pill-tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserResultItem } from '@/components/search/UserResultItem';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { ReviewResultItem } from '@/components/search/ReviewResultItem';
import { RecommendationResultItem } from '@/components/search/RecommendationResultItem';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { cn } from '@/lib/utils';
import { Search as SearchIcon, Users, MapPin, Film, Book, ShoppingBag, AlertCircle, Loader2, Star, Globe, ChevronDown, ChevronUp, Hash, Plus } from 'lucide-react';
import { useEnhancedRealtimeSearch } from '@/hooks/use-enhanced-realtime-search';
import { Badge } from '@/components/ui/badge';
import { getRandomLoadingMessage, type EntityCategory } from '@/utils/loadingMessages';
import { CreateEntityDialog } from '@/components/admin/CreateEntityDialog';
import { useToast } from '@/hooks/use-toast';

const Search = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsMobile(630); // Custom breakpoint for pill tabs
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

  // Create entity dialog state
  const [showCreateEntityDialog, setShowCreateEntityDialog] = useState(false);
  const [createEntityQuery, setCreateEntityQuery] = useState('');

  // Dropdown state for search suggestions
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownShowAll, setDropdownShowAll] = useState({
    localResults: false,
    books: false,
    movies: false,
    places: false
  });

  const { toast } = useToast();

  // Tab items configuration matching Explore page
  const tabItems = [
    { value: 'all', label: 'All', emoji: '🌟' },
    { value: 'hashtags', label: 'Hashtags', emoji: '#️⃣' },
    { value: 'movies', label: 'Movies', emoji: '🎬' },
    { value: 'books', label: 'Books', emoji: '📚' },
    { value: 'places', label: 'Places', emoji: '📍' },
    { value: 'products', label: 'Products', emoji: '🛍️' },
    { value: 'users', label: 'People', emoji: '👥' }
  ];

  const tubelightTabItems = [
    { value: 'all', label: 'All', icon: Star },
    { value: 'hashtags', label: 'Hashtags', icon: Hash },
    { value: 'movies', label: 'Movies', icon: Film },
    { value: 'books', label: 'Books', icon: Book },
    { value: 'places', label: 'Places', icon: MapPin },
    { value: 'products', label: 'Products', icon: ShoppingBag },
    { value: 'users', label: 'People', icon: Users }
  ];

  // Use the faster enhanced realtime search hook for both main search and dropdown
  const { 
    results, 
    isLoading, 
    loadingStates, 
    error,
    showAllResults,
    toggleShowAll,
    searchMode,
    refetch
  } = useEnhancedRealtimeSearch(query, { mode: mode as 'quick' | 'deep' });

  // Separate hook for dropdown search suggestions
  const { 
    results: dropdownResults,
    isLoading: dropdownLoading
  } = useEnhancedRealtimeSearch(searchQuery, { mode: 'quick' });

  // Update the URL when search query changes
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      setSearchParams({ q: searchQuery, mode: 'quick' });
      setShowDropdown(false);
    }
  };

  // Handle search input changes
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Show dropdown if query is 2+ characters and different from current query
    if (value.trim().length >= 2 && value !== query) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  // Handle dropdown item click with proper type handling
  const handleDropdownItemClick = (clickedQuery: string) => {
    setSearchQuery(clickedQuery);
    setSearchParams({ q: clickedQuery, mode: 'quick' });
    setShowDropdown(false);
  };

  // Helper function to get the display name from different result types
  const getResultDisplayName = (item: any): string => {
    if ('name' in item) return item.name;
    if ('title' in item) return item.title;
    return 'Unknown';
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

  // Handle dropdown "See More/Less" clicks
  const handleDropdownViewAll = (section: keyof typeof dropdownShowAll) => {
    setDropdownShowAll(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.search-dropdown-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      // General products that don't fall into specific categories
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
      case 'hashtags':
        return {
          localResults: [],
          externalResults: [],
          hashtags: results.hashtags || []
        };
      case 'movies':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'movie') return true;
            if ('category' in item && item.category === 'movie') return true;
            return false;
          }),
          externalResults: categorizedProducts.movies,
          hashtags: []
        };
      case 'books':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'book') return true;
            if ('category' in item && item.category === 'book') return true;
            return false;
          }),
          externalResults: categorizedProducts.books,
          hashtags: []
        };
      case 'places':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'place') return true;
            if ('category' in item && item.category === 'place') return true;
            return false;
          }),
          externalResults: categorizedProducts.places,
          hashtags: []
        };
      case 'products':
        return {
          localResults: allLocalResults.filter(item => {
            if ('type' in item && item.type === 'product') return true;
            if ('category' in item && item.category === 'product') return true;
            return false;
          }),
          externalResults: categorizedProducts.products,
          hashtags: []
        };
      case 'users':
        return {
          localResults: [],
          externalResults: [],
          users: results.users,
          hashtags: []
        };
      default: // 'all'
        return {
          localResults: allLocalResults,
          externalResults: results.products,
          users: results.users,
          hashtags: results.hashtags || []
        };
    }
  };

  const filteredResults = getFilteredResults();

  // Enhanced loading screen with category-based loading facts
  const renderEnhancedLoadingState = () => {
    const capitalizedQuery = query.charAt(0).toUpperCase() + query.slice(1);
    
    // Determine category for loading facts
    const getCategoryForFacts = (): EntityCategory => {
      switch (activeTab) {
        case 'movies': return 'movie';
        case 'books': return 'book';
        case 'places': return 'place';
        case 'products': return 'product';
        default: return 'product'; // Default for 'all' tab
      }
    };

    const loadingFact = getRandomLoadingMessage(getCategoryForFacts());

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
            {loadingFact}
          </p>
          
          {searchMode === 'deep' && (
            <div className="flex gap-2 justify-center flex-wrap">
              <Badge variant={loadingStates.external ? "default" : "outline"} className="text-xs">
                📚 Books {loadingStates.external && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
              </Badge>
              <Badge variant={loadingStates.external ? "default" : "outline"} className="text-xs">
                🎬 Movies {loadingStates.external && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
              </Badge>
              <Badge variant={loadingStates.external ? "default" : "outline"} className="text-xs">
                📍 Places {loadingStates.external && <Loader2 className="w-3 h-3 ml-1 animate-spin" />}
              </Badge>
              <Badge variant="default" className="text-xs">
                🛍️ Products <Loader2 className="w-3 h-3 ml-1 animate-spin" />
              </Badge>
            </div>
          )}
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

  // Render search dropdown
  const renderSearchDropdown = () => {
    if (!showDropdown || searchQuery.trim().length < 2) return null;

    const allLocalResults = [
      ...dropdownResults.entities,
      ...dropdownResults.reviews,
      ...dropdownResults.recommendations
    ];

    const hasResults = allLocalResults.length > 0 || 
                     dropdownResults.categorized?.books?.length > 0 ||
                     dropdownResults.categorized?.movies?.length > 0 ||
                     dropdownResults.categorized?.places?.length > 0;

    return (
      <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-96 overflow-y-auto">
        {dropdownLoading ? (
          <div className="p-4 text-center">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Searching...</p>
          </div>
        ) : hasResults ? (
          <div className="p-2">
            {/* Already on Groundz section */}
            {allLocalResults.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-md">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    ✨ Already on Groundz
                  </h3>
                  {allLocalResults.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDropdownViewAll('localResults')}
                      className="text-xs h-6"
                    >
                      {dropdownShowAll.localResults ? (
                        <>See Less <ChevronUp className="w-3 h-3 ml-1" /></>
                      ) : (
                        <>See More <ChevronDown className="w-3 h-3 ml-1" /></>
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-0">
                  {(dropdownShowAll.localResults ? allLocalResults : allLocalResults.slice(0, 3)).map((item, index, arr) => (
                    <div
                      key={item.id}
                      onClick={() => handleDropdownItemClick(getResultDisplayName(item))}
                      className={`cursor-pointer hover:bg-muted rounded p-2 transition-colors ${index < arr.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      {renderLocalResultItem(item)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Books section */}
            {dropdownResults.categorized?.books?.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-md">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    📚 Books
                  </h3>
                  {dropdownResults.categorized.books.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDropdownViewAll('books')}
                      className="text-xs h-6"
                    >
                      {dropdownShowAll.books ? (
                        <>See Less <ChevronUp className="w-3 h-3 ml-1" /></>
                      ) : (
                        <>See More <ChevronDown className="w-3 h-3 ml-1" /></>
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-0">
                  {(dropdownShowAll.books ? dropdownResults.categorized.books : dropdownResults.categorized.books.slice(0, 3)).map((book, index, arr) => (
                    <div
                      key={`${book.api_source}-${book.api_ref || index}`}
                      onClick={() => handleDropdownItemClick(book.name)}
                      className={`cursor-pointer hover:bg-muted rounded p-2 transition-colors ${index < arr.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      <SearchResultHandler
                        result={book}
                        query={searchQuery}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Movies section */}
            {dropdownResults.categorized?.movies?.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-md">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    🎬 Movies
                  </h3>
                  {dropdownResults.categorized.movies.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDropdownViewAll('movies')}
                      className="text-xs h-6"
                    >
                      {dropdownShowAll.movies ? (
                        <>See Less <ChevronUp className="w-3 h-3 ml-1" /></>
                      ) : (
                        <>See More <ChevronDown className="w-3 h-3 ml-1" /></>
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-0">
                  {(dropdownShowAll.movies ? dropdownResults.categorized.movies : dropdownResults.categorized.movies.slice(0, 3)).map((movie, index, arr) => (
                    <div
                      key={`${movie.api_source}-${movie.api_ref || index}`}
                      onClick={() => handleDropdownItemClick(movie.name)}
                      className={`cursor-pointer hover:bg-muted rounded p-2 transition-colors ${index < arr.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      <SearchResultHandler
                        result={movie}
                        query={searchQuery}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Places section */}
            {dropdownResults.categorized?.places?.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-md">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    📍 Places
                  </h3>
                  {dropdownResults.categorized.places.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDropdownViewAll('places')}
                      className="text-xs h-6"
                    >
                      {dropdownShowAll.places ? (
                        <>See Less <ChevronUp className="w-3 h-3 ml-1" /></>
                      ) : (
                        <>See More <ChevronDown className="w-3 h-3 ml-1" /></>
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-0">
                  {(dropdownShowAll.places ? dropdownResults.categorized.places : dropdownResults.categorized.places.slice(0, 3)).map((place, index, arr) => (
                    <div
                      key={`${place.api_source}-${place.api_ref || index}`}
                      onClick={() => handleDropdownItemClick(place.name)}
                      className={`cursor-pointer hover:bg-muted rounded p-2 transition-colors ${index < arr.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      <SearchResultHandler
                        result={place}
                        query={searchQuery}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Entity CTA */}
            {hasResults && (
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
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Entity
                </button>
              </div>
            )}
          </div>
        ) : (
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
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Entity
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Mobile Header - only show on screens smaller than xl */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-start min-w-0">
          <Logo size="sm" />
        </div>
      </div>
      
      <div className="flex flex-1 min-w-0">
        {/* Desktop Sidebar - only show on xl+ screens */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar 
            initialActiveTab="Explore"
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        </div>
        
        <div className={cn(
          "flex-1 min-w-0",
          "pt-16 xl:pt-0 xl:pl-64" // Mobile top padding, desktop left padding
        )}>
          <div className="container max-w-4xl mx-auto p-4 md:p-8 min-w-0">
            <h1 className="text-3xl font-bold mb-6">Search</h1>
            
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-2 min-w-0">
                <div className="relative flex-grow search-dropdown-container min-w-0">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search for people, places, products..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    className="pl-10 min-w-0"
                  />
                  {renderSearchDropdown()}
                </div>
                <Button type="submit" className="flex-shrink-0">Search</Button>
              </div>
            </form>
            
            {query ? (
              <>
                {/* Responsive Navigation - Pills for mobile/tablet, TubelightTabs for desktop */}
                {isTablet ? (
                  <div className="mb-6 overflow-x-auto">
                    <PillTabs
                      items={tabItems}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  </div>
                ) : (
                  <div className="mb-6 overflow-x-auto">
                    <TubelightTabs
                      defaultValue={activeTab}
                      items={tubelightTabItems}
                      onValueChange={setActiveTab}
                      className="mb-6"
                    >
                      <TabsContent value={activeTab}>
                        {/* Content will be rendered below */}
                      </TabsContent>
                    </TubelightTabs>
                  </div>
                )}
                
                <div className="mt-6 min-w-0">
                  {isLoading || Object.values(loadingStates).some(Boolean) ? (
                    renderEnhancedLoadingState()
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <AlertCircle className="h-8 w-8 text-destructive mb-4" />
                      <p className="text-muted-foreground">{error}</p>
                    </div>
                  ) : (
                    <>
                      {activeTab === 'all' && (
                        <>
                          {/* Already on Groundz section - Priority 1 */}
                          {filteredResults.localResults.length > 0 && (
                            <div className="mb-8 min-w-0">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Star className="h-5 w-5 text-yellow-500" /> Already on Groundz
                              </h2>
                              <div className="border rounded-md overflow-hidden min-w-0">
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
                            <div className="mb-8 min-w-0">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Globe className="h-5 w-5" /> All Items
                              </h2>
                              <p className="text-sm text-muted-foreground mb-4">
                                Everything we found related to your search.
                              </p>
                              <div className="space-y-2 min-w-0">
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
                            <div className="mb-8 min-w-0">
                              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5" /> People
                              </h2>
                              <div className="border rounded-md overflow-hidden min-w-0">
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
                          
                          {/* Add Entity CTA for all tabs */}
                          {searchMode === 'quick' && (
                            <div className="mb-8 p-6 border border-dashed rounded-lg text-center bg-gradient-to-br from-muted/30 to-muted/10 min-w-0">
                              <h3 className="text-lg font-semibold mb-2">❓ Couldn't find what you're looking for?</h3>
                              <p className="text-sm text-muted-foreground mb-1 max-w-lg mx-auto">
                                Help us build the most comprehensive database by adding missing entities
                              </p>
                              <p className="text-xs text-muted-foreground/70 mb-4 max-w-lg mx-auto italic">
                                Contribute books, movies, places, products, and more to help other users discover great content
                              </p>
                              <Button 
                                onClick={() => {
                                  console.log('Create entity from search:', query);
                                }}
                                variant="default"
                                className="bg-brand-orange hover:bg-brand-orange/90"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entity
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      
                      {/* Category-specific content */}
                      {activeTab === 'movies' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Film className="h-5 w-5" /> Movies
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Movies
                                  </h3>
                                  <div className="space-y-2 min-w-0">
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
                        </>
                      )}
                      
                      {activeTab === 'books' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Book className="h-5 w-5" /> Books
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Books
                                  </h3>
                                  <div className="space-y-2 min-w-0">
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
                        </>
                      )}
                      
                      {activeTab === 'places' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <MapPin className="h-5 w-5" /> Places
                          </h2>
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) ? (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
                                    {filteredResults.localResults.map((item) => renderLocalResultItem(item))}
                                  </div>
                                </div>
                              )}
                              {filteredResults.externalResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Globe className="h-4 w-4" /> All Places
                                  </h3>
                                  <div className="space-y-2 min-w-0">
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
                        </>
                      )}
                      
                      {activeTab === 'products' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5" /> Products
                          </h2>
                          
                          {/* Add Entity CTA for products tab */}
                          {searchMode === 'quick' && filteredResults.externalResults.length === 0 && (
                            <div className="mb-8 p-6 border border-dashed rounded-lg text-center bg-gradient-to-br from-muted/30 to-muted/10 min-w-0">
                              <h3 className="text-lg font-semibold mb-2">❓ Couldn't find what you're looking for?</h3>
                              <p className="text-sm text-muted-foreground mb-1 max-w-lg mx-auto">
                                Help us build the most comprehensive database by adding missing entities
                              </p>
                              <p className="text-xs text-muted-foreground/70 mb-4 max-w-lg mx-auto italic">
                                Contribute books, movies, places, products, and more to help other users discover great content
                              </p>
                              <Button 
                                onClick={() => {
                                  console.log('Create entity from search:', query);
                                }}
                                variant="default"
                                className="bg-brand-orange hover:bg-brand-orange/90"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entity
                              </Button>
                            </div>
                          )}
                          
                          {(filteredResults.localResults.length > 0 || filteredResults.externalResults.length > 0) && (
                            <div className="space-y-6 min-w-0">
                              {filteredResults.localResults.length > 0 && (
                                <div>
                                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                                    <Star className="h-4 w-4 text-yellow-500" /> Already on Groundz
                                  </h3>
                                  <div className="border rounded-md overflow-hidden min-w-0">
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
                                  <div className="space-y-2 min-w-0">
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
                          )}
                        </>
                      )}
                      
                       {activeTab === 'hashtags' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Hash className="h-5 w-5" /> Hashtags
                          </h2>
                          {filteredResults.hashtags && filteredResults.hashtags.length > 0 ? (
                            <div className="space-y-3 min-w-0">
                              {filteredResults.hashtags.map((hashtag) => (
                                <div
                                  key={hashtag.id}
                                  onClick={() => navigate(`/t/${hashtag.name_norm}`)}
                                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <Hash className="w-5 h-5 text-primary" />
                                    <div>
                                      <p className="font-medium">#{hashtag.name_original}</p>
                                      <p className="text-sm text-muted-foreground">{hashtag.post_count} posts</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-12 text-center">
                              <p className="text-muted-foreground">No hashtags found for "{query}"</p>
                            </div>
                          )}
                        </>
                      )}

                      {activeTab === 'users' && (
                        <>
                          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Users className="h-5 w-5" /> People
                          </h2>
                          {results.users.length > 0 ? (
                            <div className="border rounded-md overflow-hidden min-w-0">
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
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">Enter a search term to find people, places, products and more</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Create Entity Dialog */}
      <CreateEntityDialog
        open={showCreateEntityDialog}
        onOpenChange={setShowCreateEntityDialog}
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
      
      {/* Mobile Bottom Navigation - only show on screens smaller than xl */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default Search;
