import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { PostFeedItem } from '@/components/feed/PostFeedItem';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { processPosts } from '@/hooks/feed/api/posts';
import { Loader2, Hash } from 'lucide-react';

const TagPage = () => {
  const { hashtag } = useParams<{ hashtag: string }>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalHashtag, setOriginalHashtag] = useState<string>('');

  useEffect(() => {
    const fetchPostsByHashtag = async () => {
      if (!hashtag || !user) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Set original hashtag display name
        setOriginalHashtag(hashtag);
        
        // Fallback: search in post content directly using text search
        const { data: rawPosts, error } = await supabase
          .from('posts')
          .select(`
            *,
            profiles!posts_user_id_fkey (
              id,
              username,
              avatar_url
            )
          `)
          .or(`content.ilike.%#${hashtag}%,title.ilike.%#${hashtag}%`)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const processedPosts = await processPosts(rawPosts || [], user.id);
        setPosts(processedPosts);
      } catch (err) {
        console.error('Error fetching hashtag posts:', err);
        setError('Failed to load posts for this hashtag');
      } finally {
        setLoading(false);
      }
    };

    fetchPostsByHashtag();
  }, [hashtag, user]);

  const refreshFeed = () => {
    // Re-fetch posts when needed
    if (hashtag && user) {
      const fetchPosts = async () => {
        // ... same logic as above
      };
      fetchPosts();
    }
  };

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
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Hash className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">#{originalHashtag}</h1>
          </div>
          <p className="text-muted-foreground">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </p>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium mb-2">No posts found</h3>
              <p className="text-muted-foreground">
                No posts have been found with the hashtag #{originalHashtag}.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
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