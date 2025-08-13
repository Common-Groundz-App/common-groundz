import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from 'use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { searchProfiles } from '@/services/profileService';
import { getTrendingHashtags } from '@/services/hashtagService';
import { searchEntities } from '@/services/entityService';
import { SafeUserProfile } from '@/types/profile';
import { Entity } from '@/services/recommendation/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search as SearchIcon, User, Hash, Globe2 } from 'lucide-react';

export function Search() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearchTerm = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SafeUserProfile[]>([]);
  const [entityResults, setEntityResults] = useState<Entity[]>([]);
  const [hashtags, setHashtags] = useState<{ name_original: string; name_norm: string; post_count: number; }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearchTerm(value);
  }, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSearchParams({ q: e.target.value });
    debouncedSetSearch(e.target.value);
  };

  const performSearch = useCallback(async () => {
    if (!debouncedSearchTerm) {
      setSearchResults([]);
      setEntityResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [profileResults, entityResults] = await Promise.all([
        searchProfiles(debouncedSearchTerm),
        searchEntities(debouncedSearchTerm)
      ]);

      setSearchResults(profileResults);
      setEntityResults(entityResults);
    } catch (error: any) {
      console.error('Search error:', error);
      setError('Failed to perform search. Please try again.');
      setSearchResults([]);
      setEntityResults([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm]);

  const loadTrendingHashtags = useCallback(async () => {
    try {
      const { hashtags, error } = await getTrendingHashtags();
      if (error) {
        console.error('Error fetching trending hashtags:', error);
      } else {
        // Transform hashtag data to match expected format
        const transformedHashtags = hashtags.map(hashtag => ({
          name_original: hashtag.name_original,
          name_norm: hashtag.name_norm,
          post_count: Array.isArray(hashtag.post_count) ? hashtag.post_count[0]?.count || 0 : hashtag.post_count
        }));
        setHashtags(transformedHashtags);
      }
    } catch (error) {
      console.error('Error loading trending hashtags:', error);
    }
  }, []);

  useEffect(() => {
    performSearch();
    loadTrendingHashtags();
  }, [performSearch, loadTrendingHashtags]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-6 px-4">
        {/* Search Input */}
        <div className="relative mb-6">
          <Input
            type="search"
            placeholder="Search for people, entities, and more..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="rounded-full shadow-sm pl-12"
          />
          <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>

        {loading && <p className="text-muted-foreground">Loading...</p>}
        {error && <p className="text-red-500">{error}</p>}

        {/* Search Results */}
        {!loading && !error && debouncedSearchTerm && (
          <div className="space-y-6">
            {/* User Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  People
                </h3>
                <ScrollArea className="h-[200px] rounded-md">
                  <div className="space-y-2 p-3">
                    {searchResults.map((profile) => (
                      <Card
                        key={profile.id}
                        className="bg-card rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => navigate(`/profile/${profile.username}`)}
                      >
                        <CardContent className="flex items-center gap-4 p-3">
                          <Avatar>
                            <AvatarImage src={profile.avatar_url || ''} alt={profile.username} />
                            <AvatarFallback>{profile.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{profile.username}</p>
                            <p className="text-xs text-muted-foreground">{profile.fullName || 'No name'}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Entity Results */}
            {entityResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe2 className="h-5 w-5" />
                  Entities
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entityResults.map((entity) => (
                    <Card
                      key={entity.id}
                      className="bg-card rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/entity/${entity.id}`)}
                    >
                      <CardContent className="p-4">
                        <p className="text-sm font-medium">{entity.name}</p>
                        <p className="text-xs text-muted-foreground">{entity.category}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtag Results */}
            {hashtags.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Hashtags
                </h3>
                <div className="grid gap-2">
                  {hashtags.map((hashtag) => (
                    <div 
                      key={hashtag.name_norm}
                      className="flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/t/${hashtag.name_norm}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">#{hashtag.name_original}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {hashtag.post_count} posts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trending */}
        {!debouncedSearchTerm && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Trending Hashtags
              </h3>
              <div className="grid gap-2">
                {hashtags.map((hashtag) => (
                  <div
                    key={hashtag.name_norm}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => navigate(`/t/${hashtag.name_norm}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">#{hashtag.name_original}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {hashtag.post_count} posts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
