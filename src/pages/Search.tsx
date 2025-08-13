import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { normalizeHashtag } from '@/utils/hashtagUtils';
import { Search as SearchIcon, X, Hash, User, MapPin, Calendar, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SearchResult {
  id: string;
  type: 'user' | 'entity' | 'recommendation' | 'post';
  title: string;
  subtitle?: string;
  description?: string;
  image_url?: string;
  metadata?: any;
}

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize search from URL params
  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      performSearch(query);
    }
  }, [searchParams]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showDropdown) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          } else {
            handleSearch(e as any);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown, selectedIndex, results]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search users
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, first_name, last_name')
        .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5);

      if (users) {
        users.forEach(user => {
          searchResults.push({
            id: user.id,
            type: 'user',
            title: user.username || 'Unknown User',
            subtitle: [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined,
            image_url: user.avatar_url || undefined
          });
        });
      }

      // Search entities
      const { data: entities } = await supabase
        .from('entities')
        .select('id, name, type, venue, description, image_url')
        .or(`name.ilike.%${query}%,venue.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('is_deleted', false)
        .limit(10);

      if (entities) {
        entities.forEach(entity => {
          searchResults.push({
            id: entity.id,
            type: 'entity',
            title: entity.name,
            subtitle: entity.venue || entity.type,
            description: entity.description,
            image_url: entity.image_url || undefined
          });
        });
      }

      // Search recommendations
      const { data: recommendations } = await supabase
        .from('recommendations')
        .select('id, title, description, image_url, rating')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('visibility', 'public')
        .eq('is_deleted', false)
        .limit(8);

      if (recommendations) {
        recommendations.forEach(rec => {
          searchResults.push({
            id: rec.id,
            type: 'recommendation',
            title: rec.title,
            description: rec.description,
            image_url: rec.image_url || undefined,
            metadata: { rating: rec.rating }
          });
        });
      }

      // Search posts
      const { data: posts } = await supabase
        .from('posts')
        .select('id, title, content')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .eq('visibility', 'public')
        .eq('is_deleted', false)
        .limit(8);

      if (posts) {
        posts.forEach(post => {
          searchResults.push({
            id: post.id,
            type: 'post',
            title: post.title || 'Untitled Post',
            description: post.content?.substring(0, 100) + (post.content?.length > 100 ? '...' : '')
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Search Error',
        description: 'Failed to perform search. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    
    // Handle hashtag routing with proper normalization
    if (trimmedQuery.startsWith('#')) {
      const tag = normalizeHashtag(trimmedQuery.substring(1));
      if (tag && tag.length >= 2) {
        navigate(`/t/${tag}`);
        setShowDropdown(false);
        return;
      }
    }
    
    // Existing search logic
    if (trimmedQuery.length >= 2) {
      setSearchParams({ q: trimmedQuery, mode: 'quick' });
      setShowDropdown(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedIndex(-1);
    
    if (value.trim().length >= 2) {
      setShowDropdown(true);
      performSearch(value);
    } else {
      setShowDropdown(false);
      setResults([]);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setShowDropdown(false);
    setSelectedIndex(-1);
    
    switch (result.type) {
      case 'user':
        navigate(`/profile/${result.title}`);
        break;
      case 'entity':
        navigate(`/entity/${result.id}`);
        break;
      case 'recommendation':
        navigate(`/recommendation/${result.id}`);
        break;
      case 'post':
        navigate(`/post/${result.id}`);
        break;
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    setShowDropdown(false);
    setSearchParams({});
    searchInputRef.current?.focus();
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'entity':
        return <MapPin className="h-4 w-4" />;
      case 'recommendation':
        return <Star className="h-4 w-4" />;
      case 'post':
        return <Calendar className="h-4 w-4" />;
      default:
        return <SearchIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        {/* Search Header */}
        <div className="relative mb-6">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search users, places, recommendations... or try #hashtag"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => {
                  if (searchQuery.length >= 2 && results.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                className="pl-10 pr-10 h-12 text-base"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>

          {/* Search Dropdown */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
            >
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Searching...
                </div>
              ) : results.length > 0 ? (
                <div className="py-2">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                        index === selectedIndex ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {result.image_url ? (
                            <img
                              src={result.image_url}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              {getResultIcon(result.type)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {result.title}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {result.type}
                            </Badge>
                            {result.metadata?.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs text-muted-foreground">
                                  {result.metadata.rating}
                                </span>
                              </div>
                            )}
                          </div>
                          {result.subtitle && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {result.subtitle}
                            </div>
                          )}
                          {result.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {result.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchQuery.startsWith('#') ? (
                    <div className="space-y-2">
                      <Hash className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p>Press Enter to search for #{searchQuery.substring(1)}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <SearchIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p>No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Search Results Page */}
        {searchParams.get('q') && !showDropdown && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">
                Search Results for "{searchParams.get('q')}"
              </h1>
              <Badge variant="outline">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {results.length > 0 ? (
              <div className="grid gap-4">
                {results.map((result) => (
                  <Card
                    key={`${result.type}-${result.id}`}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleResultClick(result)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {result.image_url ? (
                            <img
                              src={result.image_url}
                              alt=""
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                              {getResultIcon(result.type)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold truncate">
                              {result.title}
                            </h3>
                            <Badge variant="secondary">
                              {result.type}
                            </Badge>
                            {result.metadata?.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm text-muted-foreground">
                                  {result.metadata.rating}
                                </span>
                              </div>
                            )}
                          </div>
                          {result.subtitle && (
                            <p className="text-sm text-muted-foreground mb-1">
                              {result.subtitle}
                            </p>
                          )}
                          {result.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {result.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or browse our categories.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search Tips */}
        {!searchParams.get('q') && !showDropdown && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <SearchIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Search Everything</h2>
              <p className="text-muted-foreground mb-6">
                Find users, places, recommendations, and posts all in one place.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Hash className="h-6 w-6 text-blue-600" />
                    <h3 className="font-semibold">Hashtag Search</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Search for posts by hashtag. Try typing #food or #travel to see posts about those topics.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchQuery('#food')}>
                      #food
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchQuery('#travel')}>
                      #travel
                    </Badge>
                    <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchQuery('#tech')}>
                      #tech
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <User className="h-6 w-6 text-green-600" />
                    <h3 className="font-semibold">Find People</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Search for users by username or name to discover new people and see their recommendations.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <MapPin className="h-6 w-6 text-red-600" />
                    <h3 className="font-semibold">Discover Places</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Find restaurants, cafes, attractions, and other places that have been recommended by the community.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Star className="h-6 w-6 text-yellow-600" />
                    <h3 className="font-semibold">Browse Recommendations</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Search through recommendations to find the best places and experiences shared by other users.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
