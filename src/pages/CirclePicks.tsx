
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from "@/lib/utils";
import Logo from '@/components/Logo';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, Filter, SortAsc, Search, Bell } from 'lucide-react';
import { useCirclePicks } from '@/hooks/circle-picks/use-circle-picks';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

const CirclePicks = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { 
    items, 
    filters, 
    loading, 
    error, 
    updateFilters, 
    followedCount 
  } = useCirclePicks();

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'restaurants', label: 'Restaurants' },
    { value: 'movies', label: 'Movies' },
    { value: 'books', label: 'Books' },
    { value: 'products', label: 'Products' },
    { value: 'places', label: 'Places' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'highest-rated', label: 'Highest Rated' },
    { value: 'most-liked', label: 'Most Liked' }
  ];

  const getInitialActiveTab = () => {
    return 'Circle Picks';
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Mobile Header - Fixed Position */}
        {isMobile && (
          <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
            <div className="container p-3 mx-auto flex justify-between items-center">
              <Logo size="sm" />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const event = new CustomEvent('open-search-dialog');
                    window.dispatchEvent(event);
                  }}
                  className="p-2 rounded-full hover:bg-accent"
                >
                  <Search size={20} />
                </button>
                {user && (
                  <button
                    onClick={() => {
                      const event = new CustomEvent('open-notifications');
                      window.dispatchEvent(event);
                    }}
                    className="p-2 rounded-full hover:bg-accent relative"
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-1">
          {/* Left Sidebar - Only visible on desktop */}
          {!isMobile && (
            <VerticalTubelightNavbar 
              initialActiveTab={getInitialActiveTab()}
              className="fixed left-0 top-0 h-screen pt-4 pl-4" 
            />
          )}
          
          <div className={cn(
            "flex-1 flex flex-col",
            !isMobile && "md:ml-16 lg:ml-64",
            isMobile && "pt-16"
          )}>
            <main className="flex-1 bg-background p-6">
              <div className="text-center py-12">
                <Star className="h-16 w-16 mx-auto mb-4 opacity-30 text-red-500" />
                <h3 className="text-lg font-medium mb-2 text-red-600">Error Loading Circle Picks</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </div>
            </main>
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        {isMobile && <BottomNavigation />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Header - Fixed Position */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-between items-center">
            <Logo size="sm" />
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const event = new CustomEvent('open-search-dialog');
                  window.dispatchEvent(event);
                }}
                className="p-2 rounded-full hover:bg-accent"
              >
                <Search size={20} />
              </button>
              {user && (
                <button
                  onClick={() => {
                    const event = new CustomEvent('open-notifications');
                    window.dispatchEvent(event);
                  }}
                  className="p-2 rounded-full hover:bg-accent relative"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-1">
        {/* Left Sidebar - Only visible on desktop */}
        {!isMobile && (
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4 pl-4" 
          />
        )}
        
        <div className={cn(
          "flex-1 flex flex-col",
          !isMobile && "md:ml-16 lg:ml-64",
          isMobile && "pt-16"
        )}>
          {/* Main Content Area - Three Column Layout on Desktop */}
          <div className={cn(
            "w-full mx-auto grid justify-center",
            !isMobile && "grid-cols-1 lg:grid-cols-7 xl:grid-cols-7 gap-4 px-4 py-6"
          )}>
            {/* Left Column for Navigation on Smaller Desktop */}
            {!isMobile && (
              <div className="hidden lg:block col-span-1">
                {/* This is just a spacer since VerticalTubelightNavbar is fixed */}
              </div>
            )}
            
            {/* Middle Column - Circle Picks Content */}
            <div className={cn(
              "col-span-1 lg:col-span-4 xl:col-span-4 max-w-2xl w-full mx-auto",
              isMobile && "px-0"
            )}>
              {/* Header */}
              <div className="px-4 py-6 md:py-4 mb-2">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-6 w-6 text-brand-orange" />
                  <h1 className="text-2xl font-bold">Circle Picks</h1>
                </div>
                <p className="text-muted-foreground mb-6">
                  Discover recommendations and reviews from people you follow
                </p>
                
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={filters.category} onValueChange={(value) => updateFilters({ category: value })}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <SortAsc className="h-4 w-4 text-muted-foreground" />
                    <Select value={filters.sortBy} onValueChange={(value: any) => updateFilters({ sortBy: value })}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Badge variant="secondary" className="ml-auto">
                    Following: {followedCount} people
                  </Badge>
                </div>
              </div>

              {/* Content Area */}
              <div className="px-4">
                {/* My Content Section - Collapsible */}
                <div className="mb-8">
                  <div className="border rounded-lg">
                    <div className="p-4 border-b bg-muted/50">
                      <h2 className="font-semibold text-lg flex items-center gap-2">
                        <Star className="h-5 w-5 text-brand-orange" />
                        My Recent Picks
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your latest recommendations and reviews
                      </p>
                    </div>
                    <div className="p-4">
                      <div className="text-center py-8 text-muted-foreground">
                        <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Your recent picks will appear here</p>
                        <Button variant="outline" className="mt-4">
                          Create Your First Pick
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Circle Content */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-4">From Your Circle</h2>
                  
                  {loading ? (
                    // Loading State
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="border rounded-lg p-4 bg-card animate-pulse">
                          <div className="aspect-video bg-muted rounded-md mb-4" />
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                            <div className="flex items-center gap-2 mt-3">
                              <div className="w-6 h-6 bg-muted rounded-full" />
                              <div className="h-3 bg-muted rounded w-20" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : items.length > 0 ? (
                    // Content Grid
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {items.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
                          {item.imageUrl && (
                            <div className="aspect-video bg-muted rounded-md mb-4 overflow-hidden">
                              <img 
                                src={item.imageUrl} 
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {item.type}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {item.category}
                              </Badge>
                            </div>
                            <h3 className="font-medium line-clamp-2">{item.title}</h3>
                            {item.content && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                            )}
                            <div className="flex items-center gap-2 mt-3">
                              <div className="w-6 h-6 bg-muted rounded-full overflow-hidden">
                                {item.author.avatarUrl && (
                                  <img 
                                    src={item.author.avatarUrl} 
                                    alt={item.author.username}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {item.author.username}
                              </span>
                              {item.rating && (
                                <div className="flex items-center gap-1 ml-auto">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  <span className="text-xs">{item.rating}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Empty State
                    <div className="text-center py-12 text-muted-foreground">
                      <Star className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <h3 className="text-lg font-medium mb-2">No picks yet</h3>
                      <p className="mb-4">
                        Start following people to see their recommendations and reviews here
                      </p>
                      <Button variant="outline">
                        Discover People to Follow
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right Column - Trending & Recommendations - Desktop Only */}
            {!isMobile && (
              <div className="hidden lg:block col-span-2 xl:col-span-2">
                <div className="sticky top-4 space-y-4">
                  {/* Search */}
                  <div className="bg-background rounded-xl border p-4">
                    <button 
                      onClick={() => {
                        const event = new CustomEvent('open-search-dialog');
                        window.dispatchEvent(event);
                      }}
                      className="flex items-center w-full gap-2 text-muted-foreground rounded-md border px-3 py-2 hover:bg-accent transition-colors"
                    >
                      <Search size={18} />
                      <span>Search...</span>
                    </button>
                  </div>

                  {/* Circle Stats */}
                  <div className="bg-background rounded-xl border p-4">
                    <h3 className="font-semibold text-lg mb-3">Your Circle</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Following</span>
                        <span className="font-medium">{followedCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Picks</span>
                        <span className="font-medium">{items.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Popular Categories */}
                  <div className="bg-background rounded-xl border p-4">
                    <h3 className="font-semibold text-lg mb-3">Popular Categories</h3>
                    <div className="space-y-2">
                      {["Restaurants", "Movies", "Books", "Products", "Places"].map((category) => (
                        <button
                          key={category}
                          onClick={() => updateFilters({ category: category.toLowerCase() })}
                          className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent transition-colors"
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default CirclePicks;
