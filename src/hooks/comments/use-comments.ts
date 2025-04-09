import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchComments, 
  createComment, 
  updateComment, 
  deleteComment,
  toggleCommentLike,
  incrementCommentCount
} from '@/services/commentService';
import { CommentWithUser, CreateCommentPayload, UpdateCommentPayload, CommentQueryParams } from './types';

interface UseCommentsProps {
  postId?: string;
  recommendationId?: string;
  initialParentId?: string | null;
  onCommentCountChange?: (count: number) => void;
}

export const useComments = ({ 
  postId, 
  recommendationId,
  initialParentId = null,
  onCommentCountChange
}: UseCommentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;
  
  const isMounted = useRef(true);
  const isRefreshing = useRef(false);
  
  const limit = 10;

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  const loadComments = useCallback(async (reset: boolean = false) => {
    if (!postId && !recommendationId) return;
    if (isRefreshing.current) return;
    
    isRefreshing.current = true;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const newOffset = reset ? 0 : offset;
      
      const params: CommentQueryParams = {
        limit,
        offset: newOffset,
        parent_id: parentId
      };
      
      if (postId) params.post_id = postId;
      if (recommendationId) params.recommendation_id = recommendationId;
      
      const { comments: fetchedComments, totalCount } = await fetchComments(params, user?.id);
      
      if (isMounted.current) {
        if (reset) {
          setComments(fetchedComments);
        } else {
          setComments(prev => [...prev, ...fetchedComments]);
        }
        
        setTotalCount(totalCount);
        if (onCommentCountChange) {
          onCommentCountChange(totalCount);
        }
        
        setOffset(reset ? limit : offset + limit);
        setHasMore(fetchedComments.length >= limit);
        
        setRetryCount(0);
      }
    } catch (err) {
      console.error("Error loading comments:", err);
      
      if (isMounted.current) {
        setError(err as Error);
        
        if (retryCount < maxRetries) {
          const nextRetry = Math.min(1000 * Math.pow(2, retryCount), 8000);
          console.log(`Retrying in ${nextRetry}ms (attempt ${retryCount + 1}/${maxRetries})`);
          
          setTimeout(() => {
            setRetryCount(prevCount => prevCount + 1);
            if (isMounted.current) {
              loadComments(reset);
            }
          }, nextRetry);
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load comments after multiple attempts.',
            variant: 'destructive'
          });
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
      isRefreshing.current = false;
    }
  }, [postId, recommendationId, parentId, offset, limit, user?.id, toast, onCommentCountChange, retryCount, maxRetries]);
  
  const viewReplies = useCallback((commentId: string) => {
    setParentId(commentId);
    setOffset(0);
    setHasMore(true);
    setComments([]);
  }, []);
  
  const viewMainComments = useCallback(() => {
    setParentId(null);
    setOffset(0);
    setHasMore(true);
    setComments([]);
  }, []);
  
  const addComment = useCallback(async (content: string) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to comment.',
        variant: 'destructive'
      });
      return null;
    }
    
    try {
      const payload: CreateCommentPayload = {
        content,
      };
      
      if (postId) payload.post_id = postId;
      if (recommendationId) payload.recommendation_id = recommendationId;
      if (parentId) payload.parent_id = parentId;
      
      const newComment = await createComment(payload, user.id);
      
      const commentWithUser: CommentWithUser = {
        ...newComment,
        username: user.user_metadata?.username || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        like_count: 0,
        is_liked: false,
        reply_count: 0
      };
      
      setComments(prev => [commentWithUser, ...prev]);
      
      if (!parentId) {
        const newTotalCount = totalCount + 1;
        setTotalCount(newTotalCount);
        if (onCommentCountChange) {
          onCommentCountChange(newTotalCount);
        }
        
        if (postId) {
          await incrementCommentCount('post', postId);
        } else if (recommendationId) {
          await incrementCommentCount('recommendation', recommendationId);
        }
      }
      
      toast({
        title: 'Comment Added',
        description: 'Your comment has been posted.',
      });
      
      return commentWithUser;
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  }, [postId, recommendationId, parentId, user, toast, totalCount, onCommentCountChange]);
  
  const editComment = useCallback(async (commentId: string, content: string) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to edit a comment.',
        variant: 'destructive'
      });
      return false;
    }
    
    try {
      const payload: UpdateCommentPayload = { content };
      await updateComment(commentId, payload, user.id);
      
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId ? { ...comment, content } : comment
        )
      );
      
      toast({
        title: 'Comment Updated',
        description: 'Your comment has been edited.',
      });
      
      return true;
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update comment. Please try again.',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, toast]);
  
  const removeComment = useCallback(async (commentId: string) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to delete a comment.',
        variant: 'destructive'
      });
      return false;
    }
    
    try {
      await deleteComment(commentId, user.id);
      
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      
      toast({
        title: 'Comment Deleted',
        description: 'Your comment has been removed.',
      });
      
      return true;
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete comment. Please try again.',
        variant: 'destructive'
      });
      return false;
    }
  }, [user, toast]);
  
  const handleLike = useCallback(async (commentId: string) => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to like a comment.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const isLiked = await toggleCommentLike(commentId, user.id);
      
      setComments(prev => 
        prev.map(comment => {
          if (comment.id === commentId) {
            const newLikeCount = (comment.like_count || 0) + (isLiked ? 1 : -1);
            return { ...comment, is_liked: isLiked, like_count: newLikeCount };
          }
          return comment;
        })
      );
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to process your like. Please try again.',
        variant: 'destructive'
      });
    }
  }, [user, toast]);
  
  useEffect(() => {
    if (postId || recommendationId) {
      loadComments(true);
    }
    
    return () => {
      setComments([]);
      setOffset(0);
      setHasMore(true);
      setError(null);
    };
  }, [postId, recommendationId, parentId, loadComments]);
  
  return {
    comments,
    isLoading,
    error,
    hasMore,
    loadMore: () => loadComments(false),
    refreshComments: () => loadComments(true),
    addComment,
    editComment,
    removeComment,
    handleLike,
    viewReplies,
    viewMainComments,
    isViewingReplies: parentId !== null,
    parentId,
    totalCount
  };
};
