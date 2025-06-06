import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { VerticalTubelightNavBar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import Logo from '@/components/Logo';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { useUnifiedSearch } from '@/hooks/use-unified-search';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserResultItem } from '@/components/search/UserResultItem';
import { EntityResultItem } from '@/components/search/EntityResultItem';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { Loader2, Search as SearchIcon, Filter, Home, Search as SearchIconNav, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const Search = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('products');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { 
    results, 
    isLoading, 
    error,
    searchUsers,
    searchEntities,
    searchProducts,
    clearResults
  } = useUnifiedSearch();

  const [sortOption, setSortOption] = useState('relevance');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const initialQuery = searchParams.get('q') || '';
    setQuery(initialQuery);
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [searchParams]);

  const handleSearch = useCallback((searchQuery: string) => {
    if (searchQuery) {
      searchProducts(searchQuery);
      searchEntities(searchQuery);
      searchUsers(searchQuery);
    } else {
      clearResults();
    }
  }, [searchProducts, searchEntities, searchUsers, clearResults]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`?q=${query}`);
    handleSearch(query);
  };

  const handleResultClick = () => {
    setQuery('');
    clearResults();
  };

  const getInitialActiveTab = () => {
    return 'Explore';
  };

  // Navigation items for the navbar
  const navItems = [
    { name: 'Home', url: '/home', icon: Home },
    { name: 'Explore', url: '/explore', icon: SearchIconNav },
    { name: 'Profile', url: '/profile', icon: User }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Header - Only show on mobile screens */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-start">
          <Logo size="sm" />
        </div>
      </div>
      
      <div className="flex flex-1">
        {/* Desktop Sidebar - Only show on xl+ screens */}
        <div className="hidden xl:block fixed left-0 top-0 h-screen">
          <VerticalTubelightNavBar 
            items={navItems}
            initialActiveTab={getInitialActiveTab()}
            className="h-full"
          />
        </div>
        
        <div className={cn(
          "flex-1 pt-16 md:pl-64",
        )}>
          <div className="container max-w-4xl mx-auto p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Search</h1>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter size={16} className="mr-2" />
                  Filters
                </Button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="relative mb-6">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search for products, entities, and users..."
                  value={query}
                  onChange={handleInputChange}
                  className="pr-12"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-3 rounded-md"
                >
                  <SearchIcon size={18} />
                </Button>
              </div>
            </form>
            
            {isLoading && (
              <div className="flex items-center justify-center mt-6">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            
            {error && (
              <div className="text-red-500 mt-4">Error: {error}</div>
            )}
            
            {query && !isLoading && !error && (
              <div>
                {results.products.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold mb-2">Products</h2>
                    <ul>
                      {results.products.map((product) => (
                        <SearchResultHandler
                          key={product.id}
                          result={product}
                          query={query}
                          onClose={handleResultClick}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                
                {results.entities.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold mb-2">Entities</h2>
                    <ul>
                      {results.entities.map((entity) => (
                        <EntityResultItem
                          key={entity.id}
                          entity={entity}
                          onClick={handleResultClick}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                
                {results.users.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold mb-2">Users</h2>
                    <ul>
                      {results.users.map((user) => (
                        <UserResultItem
                          key={user.id}
                          user={user}
                          onClick={handleResultClick}
                        />
                      ))}
                    </ul>
                  </div>
                )}
                
                {results.products.length === 0 && results.entities.length === 0 && results.users.length === 0 && (
                  <div className="text-muted-foreground mt-4">No results found.</div>
                )}
              </div>
            )}
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

export default Search;
