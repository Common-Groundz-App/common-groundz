import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostFeedItem } from '@/components/feed/PostFeedItem';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { HashtagSuggestions } from '@/components/hashtag/HashtagSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { processPosts } from '@/hooks/feed/api/posts';
import { getHashtagAnalytics, getPostsByHashtag, searchWithinHashtag, HashtagAnalytics } from '@/services/hashtagService';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import { Loader2, Hash, TrendingUp, TrendingDown, Users, Calendar, Search, Filter, X, Clock } from 'lucide-react';


const TagPage = () => {
  const { hashtag } = useParams<{ hashtag: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalHashtag, setOriginalHashtag] = useState<string>('');
  
  // Enhanced state for Phase 3C
  const [analytics, setAnalytics] = useState<HashtagAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PostItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  
  // Search history hook
  const { searchHistory, addToHistory, removeFromHistory } = useSearchHistory(hashtag || '');

  // Enhanced data fetching with error boundaries and sequential loading
  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchHashtagData = async () => {
      if (!hashtag || !user) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Set original hashtag display name
        setOriginalHashtag(hashtag);
        
        // Phase 1: Fetch and process posts first (critical path)
        console.log('🔄 Fetching posts for hashtag:', hashtag);
        const rawPosts = await getPostsByHashtag(hashtag, sortBy, timeFilter);
        const processedPosts = await processPosts(rawPosts, user.id);
        setPosts(processedPosts);
        setLoading(false);

        // Phase 2: Fetch analytics separately (non-blocking)
        console.log('🔄 Fetching analytics for hashtag:', hashtag);
        setAnalyticsLoading(true);
        try {
          const hashtagAnalytics = await getHashtagAnalytics(hashtag);
          setAnalytics(hashtagAnalytics);
        } catch (analyticsErr) {
          console.error('Error fetching analytics:', analyticsErr);
          // Don't block the page for analytics errors
        } finally {
          setAnalyticsLoading(false);
        }
        
      } catch (err) {
        console.error('Error fetching hashtag data:', err);
        setError('Failed to load data for this hashtag');
        setLoading(false);
        setAnalyticsLoading(false);
      }
    };

    fetchHashtagData();
    
    return () => {
      abortController.abort();
    };
  }, [hashtag, user, sortBy, timeFilter]);

  // Search within hashtag posts
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || !hashtag || !user) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const rawResults = await searchWithinHashtag(hashtag, searchQuery);
        const processedResults = await processPosts(rawResults, user.id);
        setSearchResults(processedResults);
      } catch (err) {
        console.error('Error searching within hashtag:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, hashtag, user]);

  const refreshFeed = async () => {
    // Re-fetch posts when needed
    if (hashtag && user) {
      try {
        console.log('🔄 Refreshing feed for hashtag:', hashtag);
        const rawPosts = await getPostsByHashtag(hashtag, sortBy, timeFilter);
        const processedPosts = await processPosts(rawPosts, user.id);
        setPosts(processedPosts);
      } catch (err) {
        console.error('Error refreshing feed:', err);
      }
    }
  };

  const formatGrowthRate = (rate: number) => {
    const isPositive = rate > 0;
    return {
      value: Math.abs(rate).toFixed(1),
      isPositive,
      icon: isPositive ? TrendingUp : TrendingDown
    };
  };

  const displayedPosts = searchQuery.trim() ? searchResults : posts;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchQuery.trim()) {
        addToHistory(searchQuery);
        setShowSearchHistory(false);
      } else {
        setSearchQuery('');
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSearchHistory(false);
  };

  const handleSearchFocus = () => {
    if (searchHistory.length > 0) {
      setShowSearchHistory(true);
    }
  };

  const handleSearchBlur = () => {
    // Delay hiding to allow clicks on history items
    setTimeout(() => setShowSearchHistory(false), 200);
  };

  const handleHistoryItemClick = (query: string) => {
    setSearchQuery(query);
    addToHistory(query);
    setShowSearchHistory(false);
  };

  const getInitialActiveTab = () => {
    return 'Explore';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col overflow-x-hidden">
        {/* Mobile Header */}
        <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-start">
            <Logo size="sm" />
          </div>
        </div>
        
        <div className="flex flex-1 overflow-x-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden xl:block">
            <VerticalTubelightNavbar 
              initialActiveTab={getInitialActiveTab()}
              className="fixed left-0 top-0 h-screen pt-4 pl-4"
            />
          </div>
          
          <div className="flex-1 pt-16 xl:pt-0 xl:ml-64 min-w-0">
            <div className="container max-w-4xl mx-auto p-4 md:p-8 min-w-0">
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Bottom Navigation */}
        <div className="xl:hidden">
          <BottomNavigation />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col overflow-x-hidden">
        {/* Mobile Header */}
        <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-start">
            <Logo size="sm" />
          </div>
        </div>
        
        <div className="flex flex-1 overflow-x-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden xl:block">
            <VerticalTubelightNavbar 
              initialActiveTab={getInitialActiveTab()}
              className="fixed left-0 top-0 h-screen pt-4 pl-4"
            />
          </div>
          
          <div className="flex-1 pt-16 xl:pt-0 xl:ml-64 min-w-0">
            <div className="container max-w-4xl mx-auto p-4 md:p-8 min-w-0">
              <div className="text-center py-12">
                <h2 className="text-xl font-medium mb-2">Error</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Bottom Navigation */}
        <div className="xl:hidden">
          <BottomNavigation />
        </div>
      </div>
    );
  }

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
        
        {/* Enhanced Header with Analytics */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Hash className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">#{originalHashtag}</h1>
            {analytics?.isGrowing && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                Trending
              </div>
            )}
          </div>
          
          {/* Statistics */}
          {!analyticsLoading && analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold">{analytics.totalPosts}</div>
                <div className="text-xs text-muted-foreground">Posts</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold">{analytics.totalUsers}</div>
                <div className="text-xs text-muted-foreground">Users</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-lg font-bold">
                  {(() => {
                    const growth = formatGrowthRate(analytics.growthRate);
                    const IconComponent = growth.icon;
                    return (
                      <>
                        <IconComponent className={`h-4 w-4 ${growth.isPositive ? 'text-green-600' : 'text-red-600'}`} />
                        <span className={growth.isPositive ? 'text-green-600' : 'text-red-600'}>
                          {growth.value}%
                        </span>
                      </>
                    );
                  })()}
                </div>
                <div className="text-xs text-muted-foreground">Growth</div>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold">{analytics.engagementRate.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Avg Engagement</div>
              </div>
            </div>
          )}

          {/* Enhanced Search within hashtag */}
          <div className="relative mb-6 overflow-visible">
            <div className="flex items-center border rounded-lg overflow-hidden bg-background min-w-0">
              <div className="pl-3 text-muted-foreground shrink-0">
                <Search size={18} />
              </div>
              <Input
                type="text"
                placeholder={`Search within #${originalHashtag}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-0"
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="mr-1 shrink-0 h-8 w-8 p-0"
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {isSearching && (
                <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
            
            {/* Search History Dropdown */}
            {showSearchHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="p-2 border-b text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Recent searches
                </div>
                {searchHistory.map((item, index) => (
                  <div
                    key={index}
                    className="p-2 hover:bg-muted/50 cursor-pointer flex items-center justify-between group"
                    onClick={() => handleHistoryItemClick(item.query)}
                  >
                    <span className="text-sm">{item.query}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item.query);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related hashtags */}
          <HashtagSuggestions 
            currentHashtag={originalHashtag}
            limit={6}
            className="mb-4"
          />
        </div>

        {/* Tabs for sorting and filtering */}
        <Tabs value={sortBy} onValueChange={(value) => setSortBy(value as 'recent' | 'popular')} className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select 
                value={timeFilter} 
                onChange={(e) => setTimeFilter(e.target.value as 'all' | 'week' | 'month')}
                className="bg-background border rounded px-2 py-1 text-sm"
              >
                <option value="all">All time</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
              </select>
            </div>
          </div>

          <TabsContent value="recent" className="mt-0">
            {/* Posts will be displayed here */}
          </TabsContent>
          <TabsContent value="popular" className="mt-0">
            {/* Posts will be displayed here */}
          </TabsContent>
        </Tabs>

        {/* Posts */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : displayedPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium mb-2">
                {searchQuery.trim() ? 'No search results' : 'No posts found'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery.trim() 
                  ? `No posts found for "${searchQuery}" in #${originalHashtag}.`
                  : `No posts have been found with the hashtag #${originalHashtag}.`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {searchQuery.trim() && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Search className="h-4 w-4" />
                <span>
                  {displayedPosts.length} result{displayedPosts.length !== 1 ? 's' : ''} for "{searchQuery}"
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSearchQuery('')}
                  className="h-auto p-1 text-xs"
                >
                  Clear
                </Button>
              </div>
            )}
            {displayedPosts.map((post) => (
              <PostFeedItem
                key={post.id}
                post={post}
                refreshFeed={refreshFeed}
              />
            ))}
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

export default TagPage;