import { useState, useCallback, useEffect } from 'react';
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
  
  // Default limit for comments per page
  const limit = 10;
  
  // Function to load comments
  const loadComments = useCallback(async (reset: boolean = false) => {
    if (!postId && !recommendationId) return;
    
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
      
      if (reset) {
        setComments(fetchedComments);
      } else {
        setComments(prev => [...prev, ...fetchedComments]);
      }
      
      // Set total count for parent item
      setTotalCount(totalCount);
      if (onCommentCountChange) {
        onCommentCountChange(totalCount);
      }
      
      // Update pagination
      setOffset(reset ? limit : offset + limit);
      setHasMore(fetchedComments.length >= limit);
    } catch (err) {
      setError(err as Error);
      toast({
        title: 'Error',
        description: 'Failed to load comments. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [postId, recommendationId, parentId, offset, limit, user?.id, toast, onCommentCountChange]);
  
  // Function to handle changing parent ID (for viewing replies)
  const viewReplies = useCallback((commentId: string) => {
    setParentId(commentId);
    setOffset(0);
    setHasMore(true);
  }, []);
  
  // Function to go back to main comments
  const viewMainComments = useCallback(() => {
    setParentId(null);
    setOffset(0);
    setHasMore(true);
  }, []);
  
  // Function to add a new comment
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
      
      // Optimistically add the new comment to the list
      const commentWithUser: CommentWithUser = {
        ...newComment,
        username: user.user_metadata?.username || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        like_count: 0,
        is_liked: false,
        reply_count: 0
      };
      
      setComments(prev => [commentWithUser, ...prev]);
      
      // Increment comment count in the parent item
      if (!parentId) {
        const newTotalCount = totalCount + 1;
        setTotalCount(newTotalCount);
        if (onCommentCountChange) {
          onCommentCountChange(newTotalCount);
        }
        
        // Update the comment count in the database
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
  
  // Function to edit a comment
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
      
      // Update the comment in the local state
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
  
  // Function to remove a comment
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
      
      // Remove the comment from the local state
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
  
  // Function to handle liking a comment
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
      
      // Update the comment in the local state
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
  
  // Load comments on mount or when dependencies change
  useEffect(() => {
    if (postId || recommendationId) {
      loadComments(true);
    }
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
