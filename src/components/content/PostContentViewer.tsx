import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import PostFeedItem from '@/components/feed/PostFeedItem';
import { Shell } from 'lucide-react';
import CommentsPreview from '@/components/comments/CommentsPreview';
import CommentDialog from '@/components/comments/CommentDialog';
import { useSearchParams } from 'react-router-dom';

interface PostContentViewerProps {
  postId: string;
  highlightCommentId: string | null;
  isInModal?: boolean;
}

const PostContentViewer = ({ postId, highlightCommentId, isInModal = false }: PostContentViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showComments, setShowComments] = React.useState(false);
  const [searchParams] = useSearchParams();
  
  React.useEffect(() => {
    if (highlightCommentId || searchParams.has('commentId')) {
      setShowComments(true);
    }
  }, [highlightCommentId, searchParams]);
  
  React.useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('posts')
          .select(`
            id,
            title,
            content,
            post_type,
            visibility,
            user_id,
            created_at,
            updated_at,
            media,
            view_count,
            status,
            is_deleted
          `)
          .eq('id', postId)
          .eq('is_deleted', false)
          .single();
          
        if (error) throw error;
        if (!data) {
          setError('Post not found or has been deleted');
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
        
        let taggedEntities = [];
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
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Error loading post');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load post content'
        });
      } finally {
        setLoading(false);
      }
    };
    
    if (postId) {
      fetchPost();
    }
  }, [postId, user?.id]);

  const handlePostLike = async () => {
    if (!user || !post) return;
    
    try {
      if (post.is_liked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        
        setPost({
          ...post,
          is_liked: false,
          likes: post.likes - 1
        });
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: user.id });
        
        setPost({
          ...post,
          is_liked: true,
          likes: post.likes + 1
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };
  
  const handlePostSave = async () => {
    if (!user || !post) return;
    
    try {
      if (post.is_saved) {
        await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        
        setPost({
          ...post,
          is_saved: false
        });
      } else {
        await supabase
          .from('post_saves')
          .insert({ post_id: post.id, user_id: user.id });
        
        setPost({
          ...post,
          is_saved: true
        });
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

  const handleCommentsClick = () => {
    setShowComments(true);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <Shell className="h-8 w-8 animate-pulse text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading content...</p>
        </div>
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

  return (
    <div className="p-4 sm:p-6 overflow-y-auto max-h-full">
      <PostFeedItem 
        post={post} 
        onLike={handlePostLike} 
        onSave={handlePostSave}
        onDelete={handleDelete}
        highlightCommentId={highlightCommentId}
      />

      <CommentsPreview
        commentCount={post.comment_count}
        onClick={handleCommentsClick}
      />

      {showComments && (
        <CommentDialog
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          itemId={postId}
          itemType="post"
          highlightCommentId={highlightCommentId}
        />
      )}
    </div>
  );
};

export default PostContentViewer;
