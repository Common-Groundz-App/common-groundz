
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Comment, AddCommentData, UpdateCommentData } from '@/hooks/feed/types';
import { 
  fetchComments,
  addComment as apiAddComment,
  updateComment as apiUpdateComment,
  deleteComment as apiDeleteComment
} from '@/services/commentService';
import { supabase } from '@/integrations/supabase/client';

interface UseCommentsProps {
  postId?: string;
  recommendationId?: string;
}

export const useComments = ({ postId, recommendationId }: UseCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<Record<string, Comment[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Load root comments
  const loadComments = useCallback(async () => {
    if (!user) return;
    if (!postId && !recommendationId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await fetchComments({
        postId,
        recommendationId,
        userId: user.id
      });
      
      setComments(data);
    } catch (err) {
      console.error('Error loading comments:', err);
      setError(err instanceof Error ? err : new Error('Failed to load comments'));
      
      toast({
        title: 'Error',
        description: 'Failed to load comments. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [postId, recommendationId, user, toast]);
  
  // Load replies for a comment
  const loadReplies = useCallback(async (commentId: string) => {
    if (!user) return;
    
    try {
      const replyData = await fetchComments({
        parentId: commentId,
        userId: user.id
      });
      
      setReplies(prev => ({
        ...prev,
        [commentId]: replyData
      }));
      
      // Update comment to show replies
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, showReplies: true } 
            : comment
        )
      );
    } catch (err) {
      console.error('Error loading replies:', err);
      toast({
        title: 'Error',
        description: 'Failed to load replies. Please try again.',
        variant: 'destructive'
      });
    }
  }, [user, toast]);
  
  // Toggle showing replies for a comment
  const toggleReplies = useCallback((commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    if (comment.showReplies) {
      // Hide replies
      setComments(prev => 
        prev.map(c => 
          c.id === commentId 
            ? { ...c, showReplies: false } 
            : c
        )
      );
    } else if (replies[commentId]) {
      // Show previously loaded replies
      setComments(prev => 
        prev.map(c => 
          c.id === commentId 
            ? { ...c, showReplies: true } 
            : c
        )
      );
    } else {
      // Load replies
      loadReplies(commentId);
    }
  }, [comments, replies, loadReplies]);
  
  // Add a new comment
  const addComment = useCallback(async (commentData: AddCommentData) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to comment',
        variant: 'destructive'
      });
      return null;
    }
    
    try {
      // Optimistic update
      const optimisticId = `temp-${Date.now()}`;
      const optimisticComment: Comment = {
        id: optimisticId,
        content: commentData.content,
        user_id: user.id,
        post_id: commentData.post_id || null,
        recommendation_id: commentData.recommendation_id || null,
        parent_id: commentData.parent_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        username: user.username || null,
        avatar_url: user.avatar_url || null,
        replyCount: 0,
        showReplies: false
      };
      
      // Add to correct collection based on parent
      if (commentData.parent_id) {
        // Add reply to comment
        setReplies(prev => ({
          ...prev,
          [commentData.parent_id!]: [
            ...(prev[commentData.parent_id!] || []),
            optimisticComment
          ]
        }));
        
        // Increment reply count
        setComments(prev => 
          prev.map(comment => 
            comment.id === commentData.parent_id
              ? { ...comment, replyCount: (comment.replyCount || 0) + 1 }
              : comment
          )
        );
      } else {
        // Add root comment
        setComments(prev => [...prev, optimisticComment]);
      }
      
      // Make API call
      const newComment = await apiAddComment(commentData);
      
      // Replace optimistic comment with real one
      if (commentData.parent_id) {
        // Update in replies
        setReplies(prev => ({
          ...prev,
          [commentData.parent_id!]: prev[commentData.parent_id!]
            .map(reply => 
              reply.id === optimisticId ? { ...newComment, username: user.username || null, avatar_url: user.avatar_url || null } : reply
            )
        }));
      } else {
        // Update in comments
        setComments(prev => 
          prev.map(comment => 
            comment.id === optimisticId 
              ? { ...newComment, username: user.username || null, avatar_url: user.avatar_url || null } 
              : comment
          )
        );
      }
      
      return newComment;
    } catch (err) {
      console.error('Error adding comment:', err);
      
      // Revert optimistic update
      if (commentData.parent_id) {
        setReplies(prev => ({
          ...prev,
          [commentData.parent_id!]: prev[commentData.parent_id!].filter(reply => !reply.id.startsWith('temp-'))
        }));
        
        // Decrement reply count
        setComments(prev => 
          prev.map(comment => 
            comment.id === commentData.parent_id
              ? { ...comment, replyCount: Math.max(0, (comment.replyCount || 1) - 1) }
              : comment
          )
        );
      } else {
        setComments(prev => prev.filter(comment => !comment.id.startsWith('temp-')));
      }
      
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive'
      });
      
      return null;
    }
  }, [user, toast]);
  
  // Update a comment
  const updateComment = useCallback(async ({ id, content }: UpdateCommentData) => {
    if (!user) return null;
    
    // Find if comment is in root comments or replies
    const isRoot = comments.some(comment => comment.id === id);
    const parentId = isRoot 
      ? null 
      : Object.entries(replies)
          .find(([, commentReplies]) => 
            commentReplies.some(reply => reply.id === id)
          )?.[0] || null;
    
    if (!isRoot && !parentId) return null;
    
    try {
      // Optimistic update
      if (isRoot) {
        setComments(prev => 
          prev.map(comment => 
            comment.id === id
              ? { ...comment, content, isEditing: false }
              : comment
          )
        );
      } else if (parentId) {
        setReplies(prev => ({
          ...prev,
          [parentId]: prev[parentId].map(reply => 
            reply.id === id
              ? { ...reply, content, isEditing: false }
              : reply
          )
        }));
      }
      
      // API call
      const updatedComment = await apiUpdateComment({ id, content });
      
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated successfully.'
      });
      
      return updatedComment;
    } catch (err) {
      console.error('Error updating comment:', err);
      
      // Reload comments to revert optimistic update
      loadComments();
      
      toast({
        title: 'Error',
        description: 'Failed to update comment. Please try again.',
        variant: 'destructive'
      });
      
      return null;
    }
  }, [comments, replies, user, toast, loadComments]);
  
  // Delete a comment (soft delete)
  const deleteComment = useCallback(async (id: string) => {
    if (!user) return false;
    
    // Find if comment is in root comments or replies
    const isRoot = comments.some(comment => comment.id === id);
    const parentId = isRoot 
      ? null 
      : Object.entries(replies)
          .find(([, commentReplies]) => 
            commentReplies.some(reply => reply.id === id)
          )?.[0] || null;
    
    if (!isRoot && !parentId) return false;
    
    try {
      // Optimistic update
      if (isRoot) {
        setComments(prev => 
          prev.map(comment => 
            comment.id === id
              ? { ...comment, is_deleted: true, content: '[Deleted]' }
              : comment
          )
        );
      } else if (parentId) {
        setReplies(prev => ({
          ...prev,
          [parentId]: prev[parentId].map(reply => 
            reply.id === id
              ? { ...reply, is_deleted: true, content: '[Deleted]' }
              : reply
          )
        }));
      }
      
      // API call
      await apiDeleteComment(id);
      
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been deleted.'
      });
      
      return true;
    } catch (err) {
      console.error('Error deleting comment:', err);
      
      // Reload comments to revert optimistic update
      loadComments();
      
      toast({
        title: 'Error',
        description: 'Failed to delete comment. Please try again.',
        variant: 'destructive'
      });
      
      return false;
    }
  }, [comments, replies, user, toast, loadComments]);
  
  // Set editing mode for a comment
  const setCommentEditMode = useCallback((id: string, isEditing: boolean) => {
    // Find if comment is in root comments or replies
    const isRoot = comments.some(comment => comment.id === id);
    const parentId = isRoot 
      ? null 
      : Object.entries(replies)
          .find(([, commentReplies]) => 
            commentReplies.some(reply => reply.id === id)
          )?.[0] || null;
    
    if (!isRoot && !parentId) return;
    
    if (isRoot) {
      setComments(prev => 
        prev.map(comment => 
          comment.id === id
            ? { ...comment, isEditing }
            : comment
        )
      );
    } else if (parentId) {
      setReplies(prev => ({
        ...prev,
        [parentId]: prev[parentId].map(reply => 
          reply.id === id
            ? { ...reply, isEditing }
            : reply
        )
      }));
    }
  }, [comments, replies]);
  
  // Listen for realtime comment updates
  useEffect(() => {
    if (!postId && !recommendationId) return;
    
    // Set up realtime subscription
    const channel = supabase
      .channel('comment-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: postId 
          ? `post_id=eq.${postId}` 
          : `recommendation_id=eq.${recommendationId}`
      }, (payload) => {
        console.log('Realtime comment update:', payload);
        
        // Refresh comments
        loadComments();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, recommendationId, loadComments]);
  
  // Initial load
  useEffect(() => {
    if (user) {
      loadComments();
    }
  }, [user, loadComments]);
  
  return {
    comments,
    replies,
    isLoading,
    error,
    loadComments,
    loadReplies,
    toggleReplies,
    addComment,
    updateComment,
    deleteComment,
    setCommentEditMode
  };
};
