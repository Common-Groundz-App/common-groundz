
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import PostFeedItem from '@/components/feed/PostFeedItem';
import { Shell } from 'lucide-react';

interface PostContentViewerProps {
  postId: string;
  highlightCommentId: string | null;
}

const PostContentViewer = ({ postId, highlightCommentId }: PostContentViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        
        // Fetch user profile for this post
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', data.user_id)
          .single();
          
        if (profileError) throw profileError;
        
        // Get like count
        const { count: likeCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId);
          
        // Check if user liked this post
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
        
        // Get comment count
        const { count: commentCount } = await supabase
          .from('post_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)
          .eq('is_deleted', false);
        
        // Process tagged entities if any
        let taggedEntities = [];
        try {
          // Use direct query instead of RPC function
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
        
        // Combine all data
        const processedPost = {
          ...data,
          username: profileData?.username || 'User',
          avatar_url: profileData?.avatar_url || null,
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
        // Unlike
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
        // Like
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
        // Unsave
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
        // Save
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
    </div>
  );
};

export default PostContentViewer;
