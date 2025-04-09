
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createComment, updateComment, deleteComment, fetchComments, likeComment, unlikeComment, getCommentRepliesCount } from '@/services/commentService';
import { CommentWithUser } from '@/types/comments';
import { toast } from '@/hooks/use-toast';

interface UseCommentsProps {
  post_id?: string;
  recommendation_id?: string;
}

export const useComments = ({ post_id, recommendation_id }: UseCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [repliesMap, setRepliesMap] = useState<Record<string, CommentWithUser[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [hasLoadedReplies, setHasLoadedReplies] = useState<Record<string, boolean>>({});
  
  // Fetch root comments
  const loadComments = useCallback(async () => {
    if (!post_id && !recommendation_id) return;
    
    try {
      setLoading(true);
      
      const fetchedComments = await fetchComments({
        post_id,
        recommendation_id,
        parent_id: null  // Only fetch root comments initially
      });
      
      setComments(fetchedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [post_id, recommendation_id, toast]);
  
  // Load comments on mount
  useEffect(() => {
    loadComments();
  }, [loadComments]);
  
  // Load replies for a specific comment
  const loadReplies = async (commentId: string) => {
    if (!post_id && !recommendation_id) return;
    
    if (hasLoadedReplies[commentId]) {
      return;
    }
    
    try {
      setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));
      
      const replies = await fetchComments({
        post_id,
        recommendation_id,
        parent_id: commentId
      });
      
      setRepliesMap((prev) => ({ ...prev, [commentId]: replies }));
      setHasLoadedReplies((prev) => ({ ...prev, [commentId]: true }));
    } catch (error) {
      console.error('Error fetching replies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load replies',
        variant: 'destructive'
      });
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
    }
  };
  
  // Add a new comment
  const addComment = async (content: string, parentId?: string | null) => {
    if (!user || (!post_id && !recommendation_id)) {
      console.error('Missing required data for adding comment');
      return;
    }
    
    try {
      const newComment = await createComment({
        content,
        post_id,
        recommendation_id,
        parent_id: parentId || null
      });
      
      // Create the enhanced comment with user data
      const enhancedComment: CommentWithUser = {
        ...newComment,
        username: user.username || null,
        avatar_url: user.avatar_url || null,
        likes_count: 0,
        is_liked: false,
        replies_count: 0
      };
      
      if (!parentId) {
        // It's a root comment
        setComments((prev) => [enhancedComment, ...prev]);
      } else {
        // It's a reply
        setRepliesMap((prev) => {
          const existingReplies = prev[parentId] || [];
          return {
            ...prev,
            [parentId]: [enhancedComment, ...existingReplies]
          };
        });
      }
      
      return enhancedComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive'
      });
    }
  };
  
  // Edit a comment
  const editComment = async (commentId: string, content: string, parentId?: string | null) => {
    try {
      const updatedComment = await updateComment({
        id: commentId,
        content
      });
      
      if (!parentId) {
        // Update in the main comments list
        setComments((prev) => 
          prev.map((comment) => 
            comment.id === commentId ? { ...comment, content } : comment
          )
        );
      } else {
        // Update in the replies map
        setRepliesMap((prev) => {
          const existingReplies = prev[parentId] || [];
          return {
            ...prev,
            [parentId]: existingReplies.map((reply) => 
              reply.id === commentId ? { ...reply, content } : reply
            )
          };
        });
      }
      
      return updatedComment;
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update comment',
        variant: 'destructive'
      });
    }
  };
  
  // Remove a comment (soft delete)
  const removeComment = async (commentId: string, parentId?: string | null) => {
    try {
      await deleteComment(commentId);
      
      if (!parentId) {
        // Remove from main comments list
        setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      } else {
        // Remove from replies map
        setRepliesMap((prev) => {
          const existingReplies = prev[parentId] || [];
          return {
            ...prev,
            [parentId]: existingReplies.filter((reply) => reply.id !== commentId)
          };
        });
      }
      
      toast({
        title: 'Comment deleted',
        description: 'Your comment was successfully deleted'
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive'
      });
    }
  };
  
  // Like or unlike a comment
  const handleLikeComment = async (commentId: string, isLiked: boolean, parentId?: string | null) => {
    if (!user) return;
    
    try {
      if (isLiked) {
        await unlikeComment(commentId);
      } else {
        await likeComment(commentId);
      }
      
      const updateCommentLikeStatus = (comment: CommentWithUser): CommentWithUser => {
        if (comment.id === commentId) {
          return {
            ...comment,
            is_liked: !isLiked,
            likes_count: isLiked ? Math.max(0, comment.likes_count - 1) : comment.likes_count + 1
          };
        }
        return comment;
      };
      
      if (!parentId) {
        // Update in main comments list
        setComments((prev) => prev.map(updateCommentLikeStatus));
      } else {
        // Update in replies map
        setRepliesMap((prev) => {
          const existingReplies = prev[parentId] || [];
          return {
            ...prev,
            [parentId]: existingReplies.map(updateCommentLikeStatus)
          };
        });
      }
    } catch (error) {
      console.error('Error updating comment like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like status',
        variant: 'destructive'
      });
    }
  };
  
  return {
    comments,
    loading,
    addComment,
    editComment,
    removeComment,
    likeComment: handleLikeComment,
    repliesMap,
    loadingReplies,
    loadReplies,
    hasLoadedReplies,
  };
};

export default useComments;
