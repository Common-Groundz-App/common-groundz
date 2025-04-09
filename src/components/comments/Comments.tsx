
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useComments } from '@/hooks/comments/use-comments';
import CommentList from './CommentList';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface CommentsProps {
  postId?: string;
  recommendationId?: string;
  visible?: boolean;
  onToggleVisibility?: () => void;
  onCommentCountChange?: (count: number) => void;
  initialCommentCount?: number;
}

const Comments: React.FC<CommentsProps> = ({ 
  postId, 
  recommendationId,
  visible = false,
  onToggleVisibility,
  onCommentCountChange,
  initialCommentCount = 0
}) => {
  const [showComments, setShowComments] = useState(visible);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const maxRetries = 3;
  
  // Update local state when prop changes
  React.useEffect(() => {
    setShowComments(visible);
  }, [visible]);
  
  // Handler for comment count changes
  const handleCommentCountChange = (count: number) => {
    setCommentCount(count);
    if (onCommentCountChange) {
      onCommentCountChange(count);
    }
  };
  
  const {
    comments,
    isLoading,
    error,
    hasMore,
    loadMore,
    addComment,
    editComment,
    removeComment,
    handleLike,
    viewReplies,
    viewMainComments,
    isViewingReplies,
    parentId,
    totalCount,
    refreshComments
  } = useComments({ 
    postId, 
    recommendationId,
    onCommentCountChange: handleCommentCountChange
  });

  // Update comment count when total changes
  useEffect(() => {
    if (totalCount !== undefined) {
      setCommentCount(totalCount);
    }
  }, [totalCount]);

  // Improved error handling with limited retries
  useEffect(() => {
    if (error && showComments && retryAttempt < maxRetries) {
      // Clear any existing timers
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
      
      // Add a progressive delay before retrying to prevent constant bouncing
      const delay = Math.min(2000 * Math.pow(1.5, retryAttempt), 10000);
      
      errorTimerRef.current = setTimeout(() => {
        console.log(`Retry attempt ${retryAttempt + 1}/${maxRetries}`);
        setRetryAttempt(prev => prev + 1);
        refreshComments();
      }, delay);
      
      return () => {
        if (errorTimerRef.current) {
          clearTimeout(errorTimerRef.current);
        }
      };
    }
  }, [error, showComments, refreshComments, retryAttempt, maxRetries]);

  // Reset retry attempts when comments are toggled or IDs change
  useEffect(() => {
    setRetryAttempt(0);
  }, [postId, recommendationId, showComments]);

  const handleToggleComments = () => {
    const newVisibility = !showComments;
    setShowComments(newVisibility);
    if (onToggleVisibility) {
      onToggleVisibility();
    }
  };
  
  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleComments}
        className="flex items-center gap-1"
      >
        <MessageCircle size={18} />
        {commentCount > 0 && <span>{commentCount}</span>}
        <span>{showComments ? 'Hide comments' : 'Show comments'}</span>
      </Button>
      
      <AnimatePresence>
        {showComments && (
          <motion.div 
            className="mt-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium">
                {isViewingReplies ? 'Replies' : 'Comments'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleComments}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Hide comments
              </Button>
            </div>
            
            {error && retryAttempt >= maxRetries && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Failed to load comments</AlertTitle>
                <AlertDescription className="flex justify-between items-center">
                  <span>Please try again later.</span>
                  <Button
                    size="sm" 
                    onClick={() => {
                      setRetryAttempt(0);
                      refreshComments();
                    }}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            <CommentList
              comments={comments}
              isLoading={isLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onLike={handleLike}
              onEdit={editComment}
              onDelete={removeComment}
              onReply={addComment}
              onViewReplies={viewReplies}
              isViewingReplies={isViewingReplies}
              onBackToMainComments={viewMainComments}
              parentId={parentId}
              error={error && retryAttempt >= maxRetries ? error : null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Comments;
