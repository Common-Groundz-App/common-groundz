import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostFeedItem } from '@/components/feed/PostFeedItem';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { searchWithinHashtag, getRelatedHashtags, HashtagWithCount } from '@/services/hashtagService';
import { processPosts } from '@/hooks/feed/api/posts';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Hash, Filter, ExternalLink, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EnhancedHashtagSearchResultsProps {
  isOpen: boolean;
  onClose: () => void;
  hashtag: string;
  initialQuery: string;
  onPostsUpdate?: () => void;
}

export const EnhancedHashtagSearchResults: React.FC<EnhancedHashtagSearchResultsProps> = ({
  isOpen,
  onClose,
  hashtag,
  initialQuery,
  onPostsUpdate
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<PostItem[]>([]);
  const [relatedHashtags, setRelatedHashtags] = useState<HashtagWithCount[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'hashtags'>('posts');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  // Search within hashtag
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || !hashtag || !user) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const rawResults = await searchWithinHashtag(hashtag, searchQuery, sortBy);
        const processedResults = await processPosts(rawResults, user.id);
        setSearchResults(processedResults);
      } catch (err) {
        console.error('Error searching within hashtag:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, hashtag, user, sortBy]);

  // Fetch related hashtags
  useEffect(() => {
    const fetchRelatedHashtags = async () => {
      if (!hashtag) return;
      
      setIsLoadingRelated(true);
      try {
        const related = await getRelatedHashtags(hashtag, 10);
        setRelatedHashtags(related);
      } catch (err) {
        console.error('Error fetching related hashtags:', err);
      } finally {
        setIsLoadingRelated(false);
      }
    };

    if (isOpen) {
      fetchRelatedHashtags();
    }
  }, [hashtag, isOpen]);

  const handleGlobalSearch = () => {
    const encodedQuery = encodeURIComponent(searchQuery.trim());
    navigate(`/search?q=${encodedQuery}&hashtag=${hashtag}`);
    onClose();
  };

  const handleHashtagClick = (clickedHashtag: string) => {
    navigate(`/hashtag/${clickedHashtag}`);
    onClose();
  };

  const refreshFeed = () => {
    onPostsUpdate?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search in #{hashtag}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Enhanced Search Input */}
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search within #${hashtag}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin" />
              )}
            </div>
            <Button variant="outline" onClick={handleGlobalSearch} className="shrink-0">
              <ExternalLink className="h-4 w-4 mr-2" />
              Search Everywhere
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'posts' | 'hashtags')} className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="posts" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Posts ({searchResults.length})
                </TabsTrigger>
                <TabsTrigger value="hashtags" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Related Hashtags ({relatedHashtags.length})
                </TabsTrigger>
              </TabsList>
              
              {activeTab === 'posts' && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular')}
                    className="bg-background border rounded px-2 py-1 text-sm"
                  >
                    <option value="recent">Recent</option>
                    <option value="popular">Popular</option>
                  </select>
                </div>
              )}
            </div>

            <TabsContent value="posts" className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto space-y-4">
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-medium mb-2">No posts found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery.trim() 
                        ? `No posts found for "${searchQuery}" in #${hashtag}.`
                        : `Start typing to search within #${hashtag}.`
                      }
                    </p>
                    {searchQuery.trim() && (
                      <Button variant="outline" onClick={handleGlobalSearch}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Try searching everywhere
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground mb-4">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                    </div>
                    {searchResults.map((post) => (
                      <PostFeedItem
                        key={post.id}
                        post={post}
                        refreshFeed={refreshFeed}
                      />
                    ))}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="hashtags" className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto">
                {isLoadingRelated ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : relatedHashtags.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-medium mb-2">No related hashtags found</h3>
                    <p className="text-muted-foreground">
                      No hashtags are commonly used with #{hashtag}.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {relatedHashtags.map((tag) => (
                      <Button
                        key={tag.id}
                        variant="outline"
                        className="justify-between h-auto p-4 text-left"
                        onClick={() => handleHashtagClick(tag.name_norm)}
                      >
                        <div>
                          <div className="font-medium">#{tag.name_original}</div>
                          <div className="text-sm text-muted-foreground">
                            {tag.post_count} post{tag.post_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};