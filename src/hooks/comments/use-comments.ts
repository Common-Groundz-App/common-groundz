
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Comment, CommentTarget, FetchCommentsParams, CreateCommentParams } from './types';
import { fetchComments, createComment, updateComment, deleteComment } from './api';

interface UseCommentsProps {
  target: CommentTarget;
  parentId?: string | null;
  immediate?: boolean;
  onError?: (error: Error) => void;
}

export const useComments = ({ target, parentId = null, immediate = true, onError }: UseCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params: FetchCommentsParams = { target, parent_id: parentId };
      const data = await fetchComments(params);
      
      // Add is_own_comment flag to each comment
      const enhancedComments = data.map(comment => ({
        ...comment,
        is_own_comment: user?.id === comment.user_id
      }));
      
      setComments(enhancedComments);
    } catch (err) {
      console.error('Error loading comments:', err);
      const error = err instanceof Error ? err : new Error('Failed to load comments');
      setError(error);
      
      toast({
        title: 'Error',
        description: 'Failed to load comments. Please try again.',
        variant: 'destructive'
      });
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [target, parentId, user, toast, onError]);
  
  const addComment = useCallback(async (content: string, replyToId?: string) => {
    if (!content.trim()) return;
    
    try {
      const params: CreateCommentParams = {
        content,
        target,
        parent_id: replyToId || parentId
      };
      
      const newComment = await createComment(params);
      
      // If we're in a replies list and this is a new reply to the parent
      if (parentId && !replyToId) {
        setComments(prev => [newComment, ...prev]);
      } 
      // If we're adding a comment to the main thread
      else if (!parentId && !replyToId) {
        setComments(prev => [newComment, ...prev]);
      }
      
      toast({
        title: 'Success',
        description: 'Your comment was posted.'
      });
      
      return newComment;
    } catch (err) {
      console.error('Error adding comment:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to post your comment. Please try again.',
        variant: 'destructive'
      });
      
      throw err;
    }
  }, [target, parentId, toast]);
  
  const editComment = useCallback(async (commentId: string, content: string) => {
    if (!content.trim()) return;
    
    try {
      await updateComment(commentId, content);
      
      // Update the comment in the local state
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, content, updated_at: new Date().toISOString() } 
          : comment
      ));
      
      toast({
        title: 'Success',
        description: 'Your comment was updated.'
      });
    } catch (err) {
      console.error('Error editing comment:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to update your comment. Please try again.',
        variant: 'destructive'
      });
      
      throw err;
    }
  }, [toast]);
  
  const removeComment = useCallback(async (commentId: string) => {
    try {
      await deleteComment(commentId);
      
      // Remove the comment from the local state
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      
      toast({
        title: 'Success',
        description: 'Your comment was deleted.'
      });
    } catch (err) {
      console.error('Error deleting comment:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to delete your comment. Please try again.',
        variant: 'destructive'
      });
      
      throw err;
    }
  }, [toast]);
  
  // Load comments initially if immediate is true
  useEffect(() => {
    if (immediate) {
      loadComments();
    }
  }, [immediate, loadComments]);
  
  return {
    comments,
    isLoading,
    error,
    loadComments,
    addComment,
    editComment,
    removeComment
  };
};
