
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Post {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  created_at: string;
  updated_at: string;
}

interface ProfilePostsProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfilePosts = ({ profileUserId, isOwnProfile }: ProfilePostsProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPosts = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('posts')
        .select('*')
        .eq('user_id', profileUserId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      // If not own profile, only show public posts
      if (!isOwnProfile) {
        query = query.eq('visibility', 'public');
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data as Post[]);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Error',
        description: 'Could not load posts. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [profileUserId, isOwnProfile]);

  // Refresh posts when a new post is created or posts are updated
  useEffect(() => {
    const handleRefreshPosts = () => fetchPosts();
    window.addEventListener('refresh-profile-posts', handleRefreshPosts);
    
    return () => {
      window.removeEventListener('refresh-profile-posts', handleRefreshPosts);
    };
  }, []);

  const getPostTypeLabel = (type: string) => {
    switch(type) {
      case 'story': return 'Story';
      case 'routine': return 'Routine';
      case 'project': return 'Project';
      case 'note': return 'Note';
      default: return type;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch(visibility) {
      case 'public': return 'Public';
      case 'circle_only': return 'Circle Only';
      case 'private': return 'Private';
      default: return visibility;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/4 mb-4" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-12 flex flex-col items-center">
          <div className="mb-4 p-4 bg-muted rounded-full">
            <FileText size={40} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No posts yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            {isOwnProfile ? 'You haven\'t created any posts yet.' : 'This user hasn\'t created any posts yet.'}
          </p>
          {isOwnProfile && (
            <Button 
              size="lg"
              className="px-6 bg-brand-orange hover:bg-brand-orange/90"
              onClick={() => {
                const event = new CustomEvent('open-create-post-dialog');
                window.dispatchEvent(event);
              }}
            >
              Create your first post
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map(post => (
        <Card key={post.id} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{post.title}</h3>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">{getPostTypeLabel(post.post_type)}</Badge>
                  <Badge variant="outline" className={post.visibility !== 'public' ? 'bg-muted' : ''}>
                    {getVisibilityLabel(post.visibility)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center text-muted-foreground text-sm">
                <Clock size={14} className="mr-1" />
                <span>{format(new Date(post.created_at), 'MMM d, yyyy')}</span>
              </div>
            </div>
            
            <p className="text-muted-foreground whitespace-pre-wrap">
              {post.content}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProfilePosts;
