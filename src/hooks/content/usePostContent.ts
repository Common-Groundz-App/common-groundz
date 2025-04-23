
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchComments } from '@/services/commentsService';

export const usePostContent = (postId: string, userId: string | undefined) => {
  const { toast } = useToast();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topComment, setTopComment] = useState<any>(null);

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
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', data.user_id)
          .single();
          
        if (profileError) throw profileError;
        
        const { count: likeCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId);
          
        let isLiked = false;
        let isSaved = false;
        
        if (userId) {
          const { data: likeData } = await supabase
            .from('post_likes')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .single();
            
          isLiked = !!likeData;
          
          const { data: saveData } = await supabase
            .from('post_saves')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', userId)
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
  }, [postId, userId, toast]);

  useEffect(() => {
    const fetchTopComment = async () => {
      try {
        const comments = await fetchComments(postId, 'post');
        if (comments && comments.length > 0) {
          const firstComment = comments[0];
          setTopComment({
            username: firstComment.username || 'User',
            content: firstComment.content,
          });
        } else {
          setTopComment(null);
        }
      } catch (err) {
        console.error('Error fetching top comment:', err);
        setTopComment(null);
      }
    };

    if (postId) {
      fetchTopComment();
    }
  }, [postId]);

  return { post, loading, error, topComment };
};
