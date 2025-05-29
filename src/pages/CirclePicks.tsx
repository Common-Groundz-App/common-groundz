
import React, { useState } from 'react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, Filter, SortAsc } from 'lucide-react';

const CirclePicks = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

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
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
                <Select value={sortBy} onValueChange={setSortBy}>
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
                Following: 24 people
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

          {/* Circle Content Grid */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">From Your Circle</h2>
            
            {/* Placeholder Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Placeholder cards */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border rounded-lg p-4 bg-card">
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
          </div>

          {/* Empty State */}
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
        </div>
      </main>

      <div className="md:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default CirclePicks;
