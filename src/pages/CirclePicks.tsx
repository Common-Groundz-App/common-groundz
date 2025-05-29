
import React from 'react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, Filter, SortAsc } from 'lucide-react';
import { useCirclePicks } from '@/hooks/circle-picks/use-circle-picks';

const CirclePicks = () => {
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

  if (error) {
    return (
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <VerticalTubelightNavbar />
        </div>
        
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

        <div className="md:hidden">
          <BottomNavigation />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full">
      <div className="hidden md:block">
        <VerticalTubelightNavbar />
      </div>
      
      <main className="flex-1 bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
          <div className="p-6 pb-4">
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
        </div>

        {/* Content Area */}
        <div className="p-6">
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
      </main>

      <div className="md:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default CirclePicks;
