
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Comment, CommentInput } from '@/types/comment';
import * as commentService from '@/services/commentService';

interface UseCommentsProps {
  postId?: string;
  recommendationId?: string;
  initialParentId?: string | null;
}

export function useComments({
  postId,
  recommendationId,
  initialParentId = null
}: UseCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  const loadComments = useCallback(async (reset = false) => {
    if (!postId && !recommendationId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const offset = reset ? 0 : page * limit;
      
      const { comments: newComments, total: totalCount } = await commentService.fetchComments({
        post_id: postId,
        recommendation_id: recommendationId,
        parent_id: parentId,
        limit,
        offset
      }, user?.id);
      
      setComments(prev => reset ? newComments : [...prev, ...newComments]);
      setTotal(totalCount);
      setHasMore(newComments.length === limit);
      
      if (reset) {
        setPage(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load comments'));
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [postId, recommendationId, parentId, page, limit, user?.id, toast]);

  // Load comments on mount and when dependencies change
  useEffect(() => {
    loadComments(true);
  }, [postId, recommendationId, parentId, loadComments]);

  const addComment = async (content: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You need to sign in to comment',
        variant: 'destructive'
      });
      return null;
    }
    
    if (!content.trim()) {
      return null;
    }
    
    try {
      const input: CommentInput = {
        content: content.trim(),
        user_id: user.id,
        parent_id: parentId
      };
      
      if (postId) {
        input.post_id = postId;
      } else if (recommendationId) {
        input.recommendation_id = recommendationId;
      }
      
      const newComment = await commentService.createComment(input);
      
      // Add profile data to new comment
      const commentWithProfile = {
        ...newComment,
        username: user.user_metadata?.username || 'User',
        avatar_url: user.user_metadata?.avatar_url,
        like_count: 0,
        is_liked: false,
        reply_count: 0
      };
      
      // Add to comments list
      setComments(prev => [commentWithProfile, ...prev]);
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted'
      });
      
      // Update total count
      setTotal(prev => prev + 1);
      
      // Update parent resource comment count if this is a top-level comment
      if (!parentId) {
        if (postId) {
          await commentService.incrementCommentCount('posts', postId);
        } else if (recommendationId) {
          await commentService.incrementCommentCount('recommendations', recommendationId);
        }
      }
      
      return commentWithProfile;
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive'
      });
      return null;
    }
  };

  const updateComment = async (id: string, content: string) => {
    if (!user) return false;
    
    try {
      await commentService.updateComment(id, content);
      
      setComments(prev => 
        prev.map(comment => 
          comment.id === id ? { ...comment, content } : comment
        )
      );
      
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated'
      });
      
      return true;
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update comment',
        variant: 'destructive'
      });
      return false;
    }
  };

  const deleteComment = async (id: string) => {
    if (!user) return false;
    
    try {
      await commentService.deleteComment(id);
      
      // Remove from comments list
      setComments(prev => prev.filter(comment => comment.id !== id));
      
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been removed'
      });
      
      // Update total count
      setTotal(prev => prev - 1);
      
      return true;
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive'
      });
      return false;
    }
  };

  const toggleLike = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You need to sign in to like comments',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const liked = await commentService.toggleCommentLike(id, user.id);
      
      setComments(prev => 
        prev.map(comment => {
          if (comment.id === id) {
            return {
              ...comment,
              is_liked: liked,
              like_count: (comment.like_count || 0) + (liked ? 1 : -1)
            };
          }
          return comment;
        })
      );
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to like comment',
        variant: 'destructive'
      });
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const viewReplies = (id: string) => {
    setParentId(id);
  };

  const backToMain = () => {
    setParentId(null);
  };

  return {
    comments,
    loading,
    error,
    total,
    hasMore,
    loadMore,
    addComment,
    updateComment,
    deleteComment,
    toggleLike,
    refresh: () => loadComments(true),
    viewReplies,
    backToMain,
    isViewingReplies: parentId !== null
  };
}
