
import React, { useState } from 'react';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeaturedEntities } from '@/components/explore/FeaturedEntities';
import { CategoryHighlights } from '@/components/explore/CategoryHighlights';
import { VirtualUserDirectoryList } from '@/components/explore/VirtualUserDirectoryList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useEffect } from 'react';

const Explore = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userSortOption, setUserSortOption] = useState('recent');
  const { startRender, endRender } = usePerformanceMonitor('Explore');

  useEffect(() => {
    startRender();
    return () => endRender();
  }, [startRender, endRender]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Navigate to search page with query
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Explore</h1>
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search for anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} size="default">
              Search
            </Button>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="discover" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-8 mt-6">
            <FeaturedEntities />
            <CategoryHighlights />
          </TabsContent>

          <TabsContent value="categories" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {['Movies', 'Books', 'Restaurants', 'Products', 'Places', 'Music'].map((category) => (
                <Card key={category} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CategoryHighlights entityType={category.toLowerCase() as any} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="people" className="mt-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Sort by:</span>
                </div>
                <Select value={userSortOption} onValueChange={setUserSortOption}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="active">Most Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <VirtualUserDirectoryList sortOption={userSortOption} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <Footer />
      
      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default Explore;
