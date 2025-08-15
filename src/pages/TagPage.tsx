import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
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
import { Loader2, Hash, TrendingUp, TrendingDown, Users, Calendar, Search, Filter } from 'lucide-react';


const TagPage = () => {
  const { tag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Core state
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Analytics state (loaded after posts)
  const [analytics, setAnalytics] = useState<HashtagAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Filter and search state
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [timeFilter, setTimeFilter] = useState<'all' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PostItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Pagination state
  const [nextCursor, setNextCursor] = useState<{ created_at: string; id: string } | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounced search with AbortController
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Main data fetching with AbortController
  useEffect(() => {
    if (!tag) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Step 1: Fetch posts (critical path)
        const result = await getPostsByHashtag(
          tag, 
          sortBy, 
          timeFilter, 
          user?.id || null,
          undefined, // no cursor for initial load
          20
        );
        
        // Check if request was aborted
        if (controller.signal.aborted) return;
        
        // Process posts for display
        const processedPosts = await processPosts(result.posts, user?.id || '');
        
        // Check again if request was aborted after processing
        if (controller.signal.aborted) return;
        
        // Update state only if not aborted
        setPosts(processedPosts);
        setNextCursor(result.nextCursor);
        
        // Log structured data
        console.log('Hashtag posts loaded:', {
          hashtag: tag,
          ...result.logs,
          processedCount: processedPosts.length
        });
        
      } catch (err: any) {
        if (controller.signal.aborted) return;
        
        console.error('Tag page error:', {
          hashtag: tag,
          error: err.message,
          code: err.code
        });
        setError(err.message || 'Failed to load hashtag posts');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Sequential loading: Load analytics after posts
    const loadAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const analyticsData = await getHashtagAnalytics(tag);
        
        if (!controller.signal.aborted) {
          setAnalytics(analyticsData);
        }
      } catch (err) {
        // Non-critical: Don't block UI for analytics failures
        console.warn('Analytics load failed:', { hashtag: tag, error: err.message });
      } finally {
        if (!controller.signal.aborted) {
          setAnalyticsLoading(false);
        }
      }
    };
    
    // Defer analytics until after initial posts load
    setTimeout(loadAnalytics, 100);
    
    // Cleanup function
    return () => {
      controller.abort();
    };
  }, [tag, sortBy, timeFilter, user?.id]);

  // Debounced search within hashtag
  useEffect(() => {
    if (!tag || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search to 250ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const results = await searchWithinHashtag(tag, searchQuery.trim(), 20);
        const processedResults = await processPosts(results, user?.id || '');
        
        setSearchResults(processedResults);
        
        console.log('Search within hashtag completed:', {
          hashtag: tag,
          query: searchQuery.trim(),
          resultsCount: processedResults.length
        });
      } catch (err) {
        console.warn('Search within hashtag failed:', {
          hashtag: tag,
          query: searchQuery.trim(),
          error: err.message
        });
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [tag, searchQuery, user?.id]);

  // Load more posts with cursor pagination
  const loadMorePosts = async () => {
    if (!nextCursor || loadingMore || !tag) return;
    
    try {
      setLoadingMore(true);
      
      const result = await getPostsByHashtag(
        tag,
        sortBy,
        timeFilter,
        user?.id || null,
        nextCursor,
        20
      );
      
      const processedPosts = await processPosts(result.posts, user?.id || '');
      
      setPosts(prev => [...prev, ...processedPosts]);
      setNextCursor(result.nextCursor);
      
      console.log('More posts loaded:', {
        hashtag: tag,
        ...result.logs,
        totalPosts: posts.length + processedPosts.length
      });
      
    } catch (err) {
      console.error('Load more error:', { hashtag: tag, error: err.message });
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshFeed = () => {
    // Re-fetch posts when needed - trigger effect by clearing and setting tag
    if (tag && user) {
      // Simply clear posts and trigger re-fetch via the main useEffect
      setPosts([]);
      setNextCursor(undefined);
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBarComponent />
        <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <NavBarComponent />
        <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
          <div className="text-center py-12">
            <h2 className="text-xl font-medium mb-2">Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
        
        {/* Enhanced Header with Analytics */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Hash className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">#{tag}</h1>
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

          {/* Search within hashtag */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search within #${tag}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>
          </div>

          {/* Related hashtags */}
          <HashtagSuggestions 
            currentHashtag={tag || ''}
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
                  ? `No posts found for "${searchQuery}" in #${tag}.`
                  : `No posts have been found with the hashtag #${tag}.`
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
            
            {/* Load More Button */}
            {!searchQuery.trim() && nextCursor && !loadingMore && (
              <div className="flex justify-center pt-4">
                <Button 
                  onClick={loadMorePosts}
                  variant="outline"
                  className="w-full"
                >
                  Load More Posts
                </Button>
              </div>
            )}
            
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default TagPage;