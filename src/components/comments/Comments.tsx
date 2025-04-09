
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useComments } from '@/hooks/useComments';
import CommentList from './CommentList';

interface CommentsProps {
  postId?: string;
  recommendationId?: string;
  initialVisible?: boolean;
}

export default function Comments({ 
  postId, 
  recommendationId,
  initialVisible = false
}: CommentsProps) {
  const [visible, setVisible] = useState(initialVisible);
  const { toast } = useToast();
  
  const {
    comments,
    loading,
    error,
    total,
    hasMore,
    loadMore,
    addComment,
    updateComment,
    deleteComment,
    toggleLike,
    viewReplies,
    backToMain,
    isViewingReplies
  } = useComments({
    postId,
    recommendationId
  });
  
  const handleRetry = () => {
    toast({
      title: 'Retrying',
      description: 'Loading comments again...'
    });
    window.location.reload();
  };
  
  const toggleComments = () => {
    setVisible(!visible);
  };
  
  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleComments}
        className="flex items-center gap-1"
      >
        <MessageCircle size={18} />
        {total > 0 && <span>{total}</span>}
        <span>{visible ? 'Hide comments' : 'Show comments'}</span>
      </Button>
      
      <AnimatePresence>
        {visible && (
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
                onClick={toggleComments}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Hide comments
              </Button>
            </div>
            
            <CommentList
              comments={comments}
              loading={loading}
              error={error}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onAddComment={addComment}
              onLike={toggleLike}
              onEdit={updateComment}
              onDelete={deleteComment}
              onViewReplies={viewReplies}
              onBackToMain={backToMain}
              isViewingReplies={isViewingReplies}
            />
            
            {error && (
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="outline"
                  onClick={handleRetry}
                >
                  Retry loading comments
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
