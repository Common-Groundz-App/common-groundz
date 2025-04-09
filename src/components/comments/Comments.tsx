
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useComments } from '@/hooks/comments/use-comments';
import CommentList from './CommentList';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Try to refresh comments if we encounter an error
  useEffect(() => {
    if (error && showComments) {
      // Add a slight delay before retrying to prevent immediate re-fetch
      const timer = setTimeout(() => {
        refreshComments();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [error, showComments, refreshComments]);

  const handleToggleComments = () => {
    const newVisibility = !showComments;
    setShowComments(newVisibility);
    if (onToggleVisibility) {
      onToggleVisibility();
    }
  };
  
  return (
    <div className="mt-2">
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
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Comments;
