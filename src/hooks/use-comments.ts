
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  getComments, 
  createComment, 
  updateComment, 
  deleteComment, 
  getReplyCount 
} from '@/services/commentService';
import { CommentWithUser, CommentWithReplies } from '@/types/comment';

interface UseCommentsProps {
  itemId: string;
  itemType: 'post' | 'recommendation';
  limit?: number;
}

interface UseCommentsReturn {
  comments: CommentWithReplies[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  addComment: (content: string, parentId?: string | null) => Promise<boolean>;
  updateCommentContent: (commentId: string, content: string) => Promise<boolean>;
  removeComment: (commentId: string) => Promise<boolean>;
  loadReplies: (commentId: string) => Promise<void>;
  toggleReplies: (commentId: string) => void;
}

export const useComments = ({ itemId, itemType, limit = 10 }: UseCommentsProps): UseCommentsReturn => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Fetch comments
  const fetchComments = useCallback(async (currentPage: number = 0, isLoadMore: boolean = false) => {
    try {
      const loadingState = isLoadMore ? setLoadingMore : setLoading;
      loadingState(true);
      
      const { comments: fetchedComments, hasMore: moreComments } = await getComments(
        itemId,
        itemType,
        null, // No parent ID for top-level comments
        limit,
        currentPage
      );
      
      // Get reply count for each comment
      const commentsWithReplyCount = await Promise.all(
        fetchedComments.map(async (comment) => {
          const replyCount = await getReplyCount(comment.id);
          return { 
            ...comment, 
            replyCount,
            replies: [], 
            loadingReplies: false,
            showReplies: false
          };
        })
      );

      setComments(prev => 
        isLoadMore ? [...prev, ...commentsWithReplyCount] : commentsWithReplyCount
      );
      setHasMore(moreComments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load comments'));
      toast({
        title: 'Error',
        description: 'Failed to load comments. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [itemId, itemType, limit, toast]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchComments(nextPage, true);
  }, [loadingMore, hasMore, page, fetchComments]);

  // Add a new comment
  const addComment = useCallback(async (content: string, parentId: string | null = null): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add comments',
        variant: 'destructive',
      });
      return false;
    }

    try {
      console.log('Adding comment with:', { content, userId: user.id, itemId, itemType, parentId });
      
      const newComment = await createComment(
        content,
        user.id,
        itemId,
        itemType,
        parentId
      );

      console.log('Comment created:', newComment);

      // Get user profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();

      const commentWithUser = {
        ...newComment,
        username: profile?.username || 'Anonymous',
        avatar_url: profile?.avatar_url,
        replyCount: 0,
        replies: [],
        showReplies: false,
        loadingReplies: false
      };

      // If it's a reply to another comment
      if (parentId) {
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment.id === parentId) {
              return {
                ...comment,
                replyCount: (comment.replyCount || 0) + 1,
                replies: comment.showReplies 
                  ? [commentWithUser, ...(comment.replies || [])] 
                  : (comment.replies || [])
              };
            }
            return comment;
          })
        );
      } else {
        // Add as a top-level comment
        setComments(prevComments => [commentWithUser, ...prevComments]);
      }

      return true;
    } catch (err) {
      console.error('Error adding comment:', err);
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, itemId, itemType, toast]);

  // Update a comment
  const updateCommentContent = useCallback(async (commentId: string, content: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to update comments',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const updatedComment = await updateComment(commentId, content);

      // Update the comment in state
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === commentId) {
            return { ...comment, content, updated_at: updatedComment.updated_at };
          }
          
          // Check in replies
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              replies: comment.replies.map(reply => 
                reply.id === commentId 
                  ? { ...reply, content, updated_at: updatedComment.updated_at } 
                  : reply
              )
            };
          }
          
          return comment;
        })
      );

      return true;
    } catch (err) {
      console.error('Error updating comment:', err);
      toast({
        title: 'Error',
        description: 'Failed to update comment. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast]);

  // Remove a comment
  const removeComment = useCallback(async (commentId: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to delete comments',
        variant: 'destructive',
      });
      return false;
    }

    try {
      await deleteComment(commentId);

      // Find if this is a top-level comment or a reply
      const isTopLevel = comments.some(c => c.id === commentId);
      
      if (isTopLevel) {
        // Mark the comment as deleted in state (soft delete)
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === commentId 
              ? { ...comment, content: 'This comment has been deleted.', is_deleted: true } 
              : comment
          )
        );
      } else {
        // It's a reply, find the parent and update its replies
        setComments(prevComments => 
          prevComments.map(comment => {
            if (comment.replies && comment.replies.some(r => r.id === commentId)) {
              return {
                ...comment,
                replies: comment.replies.map(reply => 
                  reply.id === commentId 
                    ? { ...reply, content: 'This comment has been deleted.', is_deleted: true } 
                    : reply
                )
              };
            }
            return comment;
          })
        );
      }

      return true;
    } catch (err) {
      console.error('Error removing comment:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete comment. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, comments, toast]);

  // Load replies for a specific comment
  const loadReplies = useCallback(async (commentId: string) => {
    // Set loading state for this comment's replies
    setComments(prevComments => 
      prevComments.map(comment => 
        comment.id === commentId ? { ...comment, loadingReplies: true } : comment
      )
    );

    try {
      const { comments: replies } = await getComments(
        itemId,
        itemType,
        commentId, // Parent ID
        2, // Initially load only 2 replies as requested
        0
      );

      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              replies,
              loadingReplies: false,
              showReplies: true
            };
          }
          return comment;
        })
      );
    } catch (err) {
      console.error('Error loading replies:', err);
      toast({
        title: 'Error',
        description: 'Failed to load replies. Please try again.',
        variant: 'destructive',
      });
      
      // Reset loading state on error
      setComments(prevComments => 
        prevComments.map(comment => 
          comment.id === commentId ? { ...comment, loadingReplies: false } : comment
        )
      );
    }
  }, [itemId, itemType, toast]);

  // Toggle showing replies for a comment
  const toggleReplies = useCallback((commentId: string) => {
    setComments(prevComments => 
      prevComments.map(comment => {
        if (comment.id === commentId) {
          // If replies haven't been loaded yet, load them
          if (!comment.replies || comment.replies.length === 0) {
            loadReplies(commentId);
            return comment;
          }
          
          // Toggle visibility if already loaded
          return { ...comment, showReplies: !comment.showReplies };
        }
        return comment;
      })
    );
  }, [loadReplies]);

  return {
    comments,
    loading,
    error,
    hasMore,
    loadMore,
    addComment,
    updateCommentContent,
    removeComment,
    loadReplies,
    toggleReplies
  };
};
