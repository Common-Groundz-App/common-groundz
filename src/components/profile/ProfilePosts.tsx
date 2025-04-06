
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Clock, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { Entity } from '@/services/recommendation/types';
import { cn } from '@/lib/utils';

interface Post {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  created_at: string;
  updated_at: string;
  tagged_entities?: Entity[];
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

      const { data: postsData, error } = await query;

      if (error) throw error;
      
      // Fetch entities for all posts using a different approach
      const postIds = (postsData || []).map(post => post.id);
      
      if (postIds.length > 0) {
        const entitiesByPostId: Record<string, Entity[]> = {};
        
        // Get all post-entity relationships
        const { data: relationships } = await supabase.rpc('get_post_entities', {
          post_ids: postIds
        });
        
        if (relationships) {
          // Process the relationships
          relationships.forEach((item: any) => {
            if (!entitiesByPostId[item.post_id]) {
              entitiesByPostId[item.post_id] = [];
            }
            entitiesByPostId[item.post_id].push(item.entity);
          });
        }
        
        // Add entities to posts
        const enrichedPosts = (postsData || []).map(post => ({
          ...post,
          tagged_entities: entitiesByPostId[post.id] || []
        }));
        
        setPosts(enrichedPosts);
      } else {
        setPosts(postsData || []);
      }
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

  // Get the entity type color
  const getEntityTypeColor = (type: string): string => {
    switch(type) {
      case 'book': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'movie': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'place': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'product': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'food': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return '';
    }
  };

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
            
            {/* Display tagged entities */}
            {post.tagged_entities && post.tagged_entities.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                  <Tag size={14} />
                  <span>Tagged:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {post.tagged_entities.map(entity => (
                    <Badge
                      key={entity.id}
                      className={cn("font-normal", getEntityTypeColor(entity.type))}
                      variant="outline"
                    >
                      {entity.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProfilePosts;
