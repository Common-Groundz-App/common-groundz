import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PostFeedItem from '@/components/feed/PostFeedItem';
import FeedSkeleton from '@/components/feed/FeedSkeleton';
import InlineCommentThread from '@/components/comments/InlineCommentThread';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/use-profile-cache';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { fetchEntityPosts } from '@/services/entityPostsService';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import type { PostFeedItem as PostFeedItemType } from '@/hooks/feed/api/posts/types';

interface PostContentViewerProps {
  postId: string;
  highlightCommentId: string | null;
  isInModal?: boolean;
  isDetailView?: boolean;
  onPostLoaded?: (meta: { title: string; content: string; visibility: string; imageUrl?: string; authorId?: string; taggedEntities?: any[] } | null) => void;
}

const PostContentViewer = ({ postId, highlightCommentId, isInModal = false, isDetailView = false, onPostLoaded }: PostContentViewerProps) => {
  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const [post, setPost] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchParams] = useSearchParams();
  
  const autoFocusComment = searchParams.has('focus') && searchParams.get('focus') === 'comment';
  
  // Related posts state
  const [relatedPosts, setRelatedPosts] = React.useState<PostFeedItemType[]>([]);
  const [relatedLoading, setRelatedLoading] = React.useState(false);
  const [relatedEntityName, setRelatedEntityName] = React.useState<string>('');
  
  const { data: authorProfile } = useProfile(post?.user_id);
  
  React.useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id, title, content, post_type, visibility, user_id,
            created_at, updated_at, media, view_count, status, is_deleted
          `)
          .eq('id', postId)
          .eq('is_deleted', false)
          .single();
          
        if (error) throw error;
        if (!data) {
          setError('Post not found or has been deleted');
          onPostLoaded?.(null);
          return;
        }
        
        const { count: likeCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId);
          
        let isLiked = false;
        let isSaved = false;
        
        if (user) {
          const { data: likeData } = await supabase
            .from('post_likes')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single();
          isLiked = !!likeData;
          
          const { data: saveData } = await supabase
            .from('post_saves')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single();
          isSaved = !!saveData;
        }
        
        const { count: commentCount } = await supabase
          .from('post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)
          .eq('is_deleted', false);
        
        let taggedEntities: any[] = [];
        try {
          const { data: entityData } = await supabase
            .from('post_entities')
            .select('entity_id, entities:entity_id(*)')
            .eq('post_id', postId);
          
          if (entityData && entityData.length > 0) {
            taggedEntities = entityData.map((item: any) => item.entities);
          }
        } catch (err) {
          console.error('Error loading entities:', err);
        }
        
        const processedPost = {
          ...data,
          likes: likeCount || 0,
          comment_count: commentCount || 0,
          is_liked: isLiked,
          is_saved: isSaved,
          tagged_entities: taggedEntities
        };
        
        setPost(processedPost);
        onPostLoaded?.({
          title: data.title || '',
          content: data.content || '',
          visibility: data.visibility || 'private',
          imageUrl: data.media?.[0]?.url || undefined,
          authorId: data.user_id || undefined,
          taggedEntities: taggedEntities,
        });
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Error loading post');
        onPostLoaded?.(null);
      } finally {
        setLoading(false);
      }
    };
    
    if (postId) {
      fetchPost();
    }
  }, [postId, user?.id]);

  // Update post with profile data when available
  React.useEffect(() => {
    if (post && authorProfile) {
      setPost((prevPost: any) => ({
        ...prevPost,
        username: authorProfile.displayName || authorProfile.username,
        avatar_url: authorProfile.avatar_url
      }));
    }
  }, [authorProfile]);

  // Fetch related posts for first tagged entity
  React.useEffect(() => {
    const fetchRelated = async () => {
      if (!post?.tagged_entities?.[0]?.id) return;
      
      const entity = post.tagged_entities[0];
      setRelatedEntityName(entity.name);
      setRelatedLoading(true);
      
      try {
        const posts = await fetchEntityPosts(entity.id, user?.id || null, 0, 6);
        // Filter out current post
        const filtered = posts.filter((p: any) => p.id !== postId);
        setRelatedPosts(filtered.slice(0, 5));
      } catch (err) {
        console.error('Error fetching related posts:', err);
      } finally {
        setRelatedLoading(false);
      }
    };
    
    if (post && !loading) {
      fetchRelated();
    }
  }, [post?.tagged_entities, loading]);

  const handlePostLike = async () => {
    if (!requireAuth({ action: 'like', surface: 'post_detail', postId: post?.id })) return;
    if (!post) return;
    
    try {
      if (post.is_liked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        setPost({ ...post, is_liked: false, likes: post.likes - 1 });
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: user.id });
        setPost({ ...post, is_liked: true, likes: post.likes + 1 });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };
  
  const handlePostSave = async () => {
    if (!requireAuth({ action: 'save', surface: 'post_detail', postId: post?.id })) return;
    if (!post) return;
    
    try {
      if (post.is_saved) {
        await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        setPost({ ...post, is_saved: false });
      } else {
        await supabase
          .from('post_saves')
          .insert({ post_id: post.id, user_id: user.id });
        setPost({ ...post, is_saved: true });
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };
  
  const handleDelete = (deletedId: string) => {
    if (deletedId === postId) {
      setError('This post has been deleted');
      setPost(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <FeedSkeleton count={1} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <h3 className="font-medium mb-2">Content Not Available</h3>
          <p className="text-muted-foreground text-sm">{error || 'This post is no longer available'}</p>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  };

  return (
    <div className="p-4 sm:p-6 overflow-y-auto max-h-full">
      {/* Back button */}
      {isDetailView && (
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      )}

      <PostFeedItem 
        post={post} 
        onLike={handlePostLike} 
        onSave={handlePostSave}
        onDelete={handleDelete}
        highlightCommentId={highlightCommentId}
        isDetailView={isDetailView}
      />

      {/* Inline Comments */}
      <div className="mt-6 pt-6 border-t">
        <InlineCommentThread
          itemId={postId}
          itemType="post"
          highlightCommentId={highlightCommentId}
          autoFocusInput={autoFocusComment}
        />
      </div>

      {/* More Experiences About [Entity] */}
      {post.tagged_entities?.[0] && (
        <div className="mt-8 pt-6 border-t">
          <h3 className="font-semibold text-sm mb-4">
            More experiences about {relatedEntityName}
          </h3>
          
          {relatedLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 items-start">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : relatedPosts.length === 0 ? (
            <div className="text-center py-6">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground mb-3">
                No more experiences yet. Be the first to share yours about {relatedEntityName}.
              </p>
              {user && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/')}
                >
                  Share your experience
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {relatedPosts.map((relatedPost) => (
                <div
                  key={relatedPost.id}
                  className="cursor-pointer rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/post/${relatedPost.id}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/post/${relatedPost.id}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{relatedPost.displayName || relatedPost.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(relatedPost.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {relatedPost.title && (
                    <p className="text-sm font-medium mb-1">{relatedPost.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {relatedPost.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostContentViewer;
