import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostFeedItem } from '@/components/feed/PostFeedItem';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { HashtagSuggestions } from '@/components/hashtag/HashtagSuggestions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { processPosts } from '@/hooks/feed/api/posts';
import { getHashtagAnalytics, getPostsByHashtag, searchWithinHashtag, HashtagAnalytics } from '@/services/hashtagService';
import { Loader2, Hash, TrendingUp, TrendingDown, Users, Calendar, Search, Filter } from 'lucide-react';
import { HashtagDebug } from '@/components/dev/HashtagDebug';

const TagPage = () => {
  const { hashtag } = useParams<{ hashtag: string }>();
  const { user } = useAuth();
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

  // Enhanced data fetching for Phase 3C
  useEffect(() => {
    const fetchHashtagData = async () => {
      if (!hashtag || !user) return;
      
      setLoading(true);
      setAnalyticsLoading(true);
      setError(null);
      
      try {
        // Set original hashtag display name
        setOriginalHashtag(hashtag);
        
        // Fetch posts with sorting and filtering
        const rawPosts = await getPostsByHashtag(hashtag, sortBy, timeFilter);
        const processedPosts = await processPosts(rawPosts, user.id);
        setPosts(processedPosts);

        // Fetch hashtag analytics
        const hashtagAnalytics = await getHashtagAnalytics(hashtag);
        setAnalytics(hashtagAnalytics);
      } catch (err) {
        console.error('Error fetching hashtag data:', err);
        setError('Failed to load data for this hashtag');
      } finally {
        setLoading(false);
        setAnalyticsLoading(false);
      }
    };

    fetchHashtagData();
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

  const refreshFeed = () => {
    // Re-fetch posts when needed
    if (hashtag && user) {
      const fetchPosts = async () => {
        const rawPosts = await getPostsByHashtag(hashtag, sortBy, timeFilter);
        const processedPosts = await processPosts(rawPosts, user.id);
        setPosts(processedPosts);
      };
      fetchPosts();
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
        {/* Debug tools for development */}
        <HashtagDebug />
        
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

          {/* Search within hashtag */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search within #${originalHashtag}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>
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
      <Footer />
    </div>
  );
};

export default TagPage;