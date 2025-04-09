
import React, { useState } from 'react';
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
}

const Comments: React.FC<CommentsProps> = ({ 
  postId, 
  recommendationId,
  visible = false,
  onToggleVisibility
}) => {
  const [showComments, setShowComments] = useState(visible);
  
  // Update local state when prop changes
  React.useEffect(() => {
    setShowComments(visible);
  }, [visible]);
  
  const {
    comments,
    isLoading,
    hasMore,
    loadMore,
    addComment,
    editComment,
    removeComment,
    handleLike,
    viewReplies,
    viewMainComments,
    isViewingReplies,
    parentId
  } = useComments({ 
    postId, 
    recommendationId 
  });

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
