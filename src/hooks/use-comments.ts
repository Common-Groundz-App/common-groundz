
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  CommentWithUser, 
  FetchCommentsParams, 
  CreateCommentParams,
  UpdateCommentParams
} from '@/types/comments';
import {
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
  likeComment as likeCommentService,
  unlikeComment as unlikeCommentService
} from '@/services/commentService';

interface UseCommentsParams {
  post_id?: string;
  recommendation_id?: string;
}

interface UseCommentsState {
  comments: CommentWithUser[];
  loading: boolean;
  error: Error | null;
}

export const useComments = ({ post_id, recommendation_id }: UseCommentsParams) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<UseCommentsState>({
    comments: [],
    loading: false,
    error: null
  });
  const [repliesMap, setRepliesMap] = useState<Map<string, CommentWithUser[]>>(new Map());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  // Validate input
  if ((!post_id && !recommendation_id) || (post_id && recommendation_id)) {
    throw new Error('Either post_id OR recommendation_id must be provided, not both or neither');
  }

  const fetchCommentsData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const params: FetchCommentsParams = {
        post_id,
        recommendation_id,
        parent_id: null
      };
      
      const fetchedComments = await fetchComments(params);
      
      setState(prev => ({ 
        ...prev, 
        comments: fetchedComments,
        loading: false 
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error : new Error('Failed to fetch comments'),
        loading: false
      }));
      
      toast({
        title: 'Error',
        description: 'Failed to load comments. Please try again.',
        variant: 'destructive'
      });
    }
  }, [post_id, recommendation_id, toast]);

  // Fetch comments when the hook is first used
  useEffect(() => {
    if (post_id || recommendation_id) {
      fetchCommentsData();
    }
  }, [fetchCommentsData]);

  // Add a new comment
  const addComment = useCallback(async (content: string, parentId: string | null = null) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add a comment',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const params: CreateCommentParams = {
        content,
        post_id,
        recommendation_id,
        parent_id: parentId
      };
      
      // Optimistic update
      const optimisticId = Date.now().toString();
      const optimisticComment: CommentWithUser = {
        id: optimisticId,
        content,
        user_id: user.id,
        post_id: post_id || null,
        recommendation_id: recommendation_id || null,
        parent_id: parentId || null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        username: user.username || null,
        avatar_url: user.avatar_url || null,
        likes_count: 0,
        is_liked: false,
        replies_count: 0
      };
      
      if (parentId) {
        // Add to replies
        setRepliesMap(prev => {
          const newMap = new Map(prev);
          const existingReplies = newMap.get(parentId) || [];
          newMap.set(parentId, [optimisticComment, ...existingReplies]);
          return newMap;
        });
        
        // Update replies count for parent comment
        setState(prev => ({
          ...prev,
          comments: prev.comments.map(comment => 
            comment.id === parentId 
              ? { ...comment, replies_count: comment.replies_count + 1 }
              : comment
          )
        }));
      } else {
        // Add to main comments
        setState(prev => ({
          ...prev,
          comments: [optimisticComment, ...prev.comments]
        }));
      }
      
      // Send to server
      const newComment = await createComment(params);
      
      // Update with server data
      if (parentId) {
        setRepliesMap(prev => {
          const newMap = new Map(prev);
          const existingReplies = newMap.get(parentId) || [];
          newMap.set(parentId, existingReplies.map(reply => 
            reply.id === optimisticId 
              ? { 
                  ...newComment, 
                  username: user.username || null,
                  avatar_url: user.avatar_url || null,
                  likes_count: 0,
                  is_liked: false,
                  replies_count: 0
                }
              : reply
          ));
          return newMap;
        });
      } else {
        setState(prev => ({
          ...prev,
          comments: prev.comments.map(comment => 
            comment.id === optimisticId 
              ? { 
                  ...newComment, 
                  username: user.username || null,
                  avatar_url: user.avatar_url || null,
                  likes_count: 0,
                  is_liked: false,
                  replies_count: 0
                }
              : comment
          )
        }));
      }
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been added successfully.',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive'
      });
    }
  }, [user, toast, post_id, recommendation_id]);

  // Update an existing comment
  const editComment = useCallback(async (id: string, content: string, parentId: string | null = null) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to edit comments',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      const params: UpdateCommentParams = {
        id,
        content
      };
      
      // Optimistic update
      if (parentId) {
        setRepliesMap(prev => {
          const newMap = new Map(prev);
          const existingReplies = newMap.get(parentId) || [];
          newMap.set(parentId, existingReplies.map(reply => 
            reply.id === id 
              ? { ...reply, content, updated_at: new Date().toISOString() }
              : reply
          ));
          return newMap;
        });
      } else {
        setState(prev => ({
          ...prev,
          comments: prev.comments.map(comment => 
            comment.id === id 
              ? { ...comment, content, updated_at: new Date().toISOString() }
              : comment
          )
        }));
      }
      
      // Send to server
      await updateComment(params);
      
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to update comment. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update
      fetchCommentsData();
    }
  }, [user, toast, fetchCommentsData]);

  // Delete a comment
  const removeComment = useCallback(async (id: string, parentId: string | null = null) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to delete comments',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      // Optimistic update
      if (parentId) {
        setRepliesMap(prev => {
          const newMap = new Map(prev);
          const existingReplies = newMap.get(parentId) || [];
          newMap.set(parentId, existingReplies.filter(reply => reply.id !== id));
          
          // Update replies count for parent comment
          setState(prevState => ({
            ...prevState,
            comments: prevState.comments.map(comment => 
              comment.id === parentId 
                ? { ...comment, replies_count: Math.max(0, comment.replies_count - 1) }
                : comment
            )
          }));
          
          return newMap;
        });
      } else {
        setState(prev => ({
          ...prev,
          comments: prev.comments.filter(comment => comment.id !== id)
        }));
        
        // Also remove any replies for this comment
        setRepliesMap(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
      }
      
      // Send to server
      await deleteComment(id);
      
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been deleted.',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to delete comment. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update
      fetchCommentsData();
    }
  }, [user, toast, fetchCommentsData]);

  // Toggle like on a comment
  const likeComment = useCallback(async (id: string, isLiked: boolean, parentId: string | null = null) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like comments',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      // Optimistic update
      if (parentId) {
        setRepliesMap(prev => {
          const newMap = new Map(prev);
          const existingReplies = newMap.get(parentId) || [];
          newMap.set(parentId, existingReplies.map(reply => 
            reply.id === id 
              ? { 
                  ...reply, 
                  is_liked: !isLiked, 
                  likes_count: isLiked ? Math.max(0, reply.likes_count - 1) : reply.likes_count + 1 
                }
              : reply
          ));
          return newMap;
        });
      } else {
        setState(prev => ({
          ...prev,
          comments: prev.comments.map(comment => 
            comment.id === id 
              ? { 
                  ...comment, 
                  is_liked: !isLiked, 
                  likes_count: isLiked ? Math.max(0, comment.likes_count - 1) : comment.likes_count + 1 
                }
              : comment
          )
        }));
      }
      
      // Send to server
      if (isLiked) {
        await unlikeCommentService(id);
      } else {
        await likeCommentService(id);
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
      
      // Revert optimistic update
      if (parentId) {
        setRepliesMap(prev => {
          const newMap = new Map(prev);
          const existingReplies = newMap.get(parentId) || [];
          newMap.set(parentId, existingReplies.map(reply => 
            reply.id === id 
              ? { 
                  ...reply, 
                  is_liked: isLiked, 
                  likes_count: isLiked ? reply.likes_count + 1 : Math.max(0, reply.likes_count - 1) 
                }
              : reply
          ));
          return newMap;
        });
      } else {
        setState(prev => ({
          ...prev,
          comments: prev.comments.map(comment => 
            comment.id === id 
              ? { 
                  ...comment, 
                  is_liked: isLiked, 
                  likes_count: isLiked ? comment.likes_count + 1 : Math.max(0, comment.likes_count - 1)
                }
              : comment
          )
        }));
      }
    }
  }, [user, toast]);

  // Load replies for a comment
  const loadReplies = useCallback(async (commentId: string) => {
    try {
      // Skip if already loading or if already loaded
      if (loadingReplies.has(commentId) || repliesMap.has(commentId)) {
        return;
      }
      
      setLoadingReplies(prev => new Set([...prev, commentId]));
      
      const params: FetchCommentsParams = {
        post_id,
        recommendation_id,
        parent_id: commentId
      };
      
      const fetchedReplies = await fetchComments(params);
      
      setRepliesMap(prev => {
        const newMap = new Map(prev);
        newMap.set(commentId, fetchedReplies);
        return newMap;
      });
      
      setLoadingReplies(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(commentId);
        return newSet;
      });
    } catch (error) {
      console.error('Error loading replies:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to load replies. Please try again.',
        variant: 'destructive'
      });
      
      setLoadingReplies(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(commentId);
        return newSet;
      });
    }
  }, [post_id, recommendation_id, loadingReplies, repliesMap, toast]);

  return {
    comments: state.comments,
    loading: state.loading,
    error: state.error,
    addComment,
    editComment,
    removeComment,
    likeComment,
    refreshComments: fetchCommentsData,
    
    // Replies handling
    repliesMap,
    loadingReplies: Array.from(loadingReplies),
    loadReplies,
    
    // Check if a comment has replies loaded
    hasLoadedReplies: (commentId: string) => repliesMap.has(commentId),
    isLoadingReplies: (commentId: string) => loadingReplies.has(commentId),
    getReplies: (commentId: string) => repliesMap.get(commentId) || []
  };
};

export default useComments;
