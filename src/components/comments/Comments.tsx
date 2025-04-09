
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useComments } from '@/hooks/comments/use-comments';
import CommentList from './CommentList';
import { motion, AnimatePresence } from 'framer-motion';

interface CommentsProps {
  postId?: string;
  recommendationId?: string;
}

const Comments: React.FC<CommentsProps> = ({ postId, recommendationId }) => {
  const [showComments, setShowComments] = useState(false);
  
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
  
  return (
    <div className="mt-2">
      {!showComments ? (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowComments(true)}
          className="flex items-center gap-1"
        >
          <MessageCircle size={18} />
          Show comments
        </Button>
      ) : (
        <AnimatePresence>
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
                onClick={() => setShowComments(false)}
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
        </AnimatePresence>
      )}
    </div>
  );
};

export default Comments;
