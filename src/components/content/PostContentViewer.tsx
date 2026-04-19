import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PostFeedItem from '@/components/feed/PostFeedItem';
import FeedSkeleton from '@/components/feed/FeedSkeleton';
import InlineCommentThread from '@/components/comments/InlineCommentThread';
import StructuredFieldsDisplay from '@/components/content/StructuredFieldsDisplay';
import { shouldShowTypeBadge, getPostTypeLabel } from '@/components/feed/utils/postUtils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/use-profile-cache';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { useUserFollowing } from '@/hooks/useUserFollowing';
import { fetchEntityPosts } from '@/services/entityPostsService';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
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
  const { data: followingIds = [] } = useUserFollowing();
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
  
  const fetchPost = React.useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, title, content, post_type, visibility, user_id,
          created_at, updated_at, last_edited_at, media, view_count, status, is_deleted, structured_fields
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
        taggedEntities: taggedEntities.map((e: any) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          slug: e.slug,
          description: e.description,
          image_url: e.image_url,
          category_id: e.category_id,
          venue: e.venue,
        })),
      });
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Error loading post');
      onPostLoaded?.(null);
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id, onPostLoaded]);

  React.useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId, fetchPost]);

  // Re-fetch on edit events from anywhere in the app (composer dialogs, etc.)
  React.useEffect(() => {
    const handleRefresh = () => {
      if (postId) fetchPost();
    };
    window.addEventListener('refresh-feed', handleRefresh);
    window.addEventListener('refresh-profile-posts', handleRefresh);
    return () => {
      window.removeEventListener('refresh-feed', handleRefresh);
      window.removeEventListener('refresh-profile-posts', handleRefresh);
    };
  }, [postId, fetchPost]);

  // Update post with profile data when available
  React.useEffect(() => {
    if (post && authorProfile) {
      setPost((prevPost: any) => ({
        ...prevPost,
        displayName: authorProfile.displayName || authorProfile.username,
        username: authorProfile.username,
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

  // Listen for entity-specific refresh after new post creation
  React.useEffect(() => {
    const handleRefresh = (e: Event) => {
      const refreshedEntityId = (e as CustomEvent)?.detail?.entityId;
      const entity = post?.tagged_entities?.[0];
      const currentEntityId = entity?.entity_id ?? entity?.id;
      if (!currentEntityId || refreshedEntityId !== currentEntityId) return;

      fetchEntityPosts(currentEntityId, user?.id || null, 0, 6).then(posts => {
        const filtered = posts.filter((p: any) => p.id !== postId);
        setRelatedPosts(filtered.slice(0, 5));
      });
    };
    window.addEventListener('refresh-posts', handleRefresh);
    return () => window.removeEventListener('refresh-posts', handleRefresh);
  }, [post?.tagged_entities, user?.id, postId]);

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

      {/* Post Type Badge (detail view) */}
      {shouldShowTypeBadge(post.post_type ?? 'story') && (
        <div className="mt-2 mb-1 px-1">
          <span className="text-xs text-muted-foreground/70 border border-border/50 rounded-full px-2 py-0.5">
            {getPostTypeLabel(post.post_type ?? 'story')}
          </span>
        </div>
      )}

      {/* Structured Experience Fields */}
      {post.structured_fields && typeof post.structured_fields === 'object' && (
        <StructuredFieldsDisplay data={post.structured_fields} />
      )}

      {/* Inline Comments */}
      <div className="mt-6 pt-6 border-t">
        <InlineCommentThread
          itemId={postId}
          itemType="post"
          highlightCommentId={highlightCommentId}
          autoFocusInput={autoFocusComment}
        />
      </div>

      {/* Real Experiences About [Entity] */}
      {post.tagged_entities?.[0] && (() => {
        const circlePosts = relatedPosts.filter((p: any) => followingIds.includes(p.user_id));
        const communityPosts = relatedPosts.filter((p: any) => !followingIds.includes(p.user_id));
        
        return (
          <div className="mt-10 pt-8 border-t border-border/50 animate-fade-in">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-foreground">
                Real experiences with {relatedEntityName}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                See how people actually used it
              </p>
            </div>
            
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
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex -space-x-2 mb-5">
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background" />
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background" />
                  <div className="h-8 w-8 rounded-full bg-muted border-2 border-background" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1.5">
                  No experiences about {relatedEntityName} yet
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mb-5">
                  People who've tried {relatedEntityName} haven't shared here yet. Be the first from your Circle!
                </p>
                {user && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mb-2 border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                    onClick={() => {
                      const entity = post.tagged_entities?.[0];
                      const entityId = entity?.entity_id ?? entity?.id;
                      const params = new URLSearchParams();
                      if (entityId) params.set('entityId', entityId);
                      if (relatedEntityName) params.set('entityName', relatedEntityName);
                      const qs = params.toString();
                      navigate(`/create${qs ? `?${qs}` : ''}`);
                    }}
                  >
                    Share your experience
                  </Button>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Your experience could help someone decide.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* From your Circle */}
                {circlePosts.length > 0 && (
                  <div className="border-l-2 border-orange-400 bg-orange-50/20 dark:bg-orange-950/20 rounded-lg p-3 space-y-3">
                    <div className="mb-2">
                      <p className="text-sm font-medium text-foreground">From your Circle</p>
                      <p className="text-xs text-muted-foreground">Trusted experiences from your Circle</p>
                    </div>
                    {circlePosts.map((relatedPost, index) => (
                      <div
                        key={relatedPost.id}
                        className="animate-fade-in hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200"
                        style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                      >
                        <PostFeedItem
                          post={relatedPost as any}
                          onLike={() => {}}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* From the community */}
                {communityPosts.length > 0 && (
                  <div className="space-y-3">
                    {circlePosts.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">From the community</p>
                    )}
                    {communityPosts.map((relatedPost, index) => (
                      <div
                        key={relatedPost.id}
                        className="animate-fade-in hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200"
                        style={{ animationDelay: `${(circlePosts.length + index) * 100}ms`, animationFillMode: 'backwards' }}
                      >
                        <PostFeedItem
                          post={relatedPost as any}
                          onLike={() => {}}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default PostContentViewer;
