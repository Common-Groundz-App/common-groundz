
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useComments } from '@/hooks/comments/use-comments';
import CommentList from './CommentList';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [showComments, setShowComments] = useState(visible);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  
  // Update local state when prop changes
  React.useEffect(() => {
    setShowComments(visible);
  }, [visible]);
  
  // Handler for comment count changes
  const handleCommentCountChange = (count: number) => {
    console.log('Comment count changed:', count);
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
      console.log('Total comment count updated:', totalCount);
      setCommentCount(totalCount);
    }
  }, [totalCount]);

  const handleToggleComments = () => {
    const newVisibility = !showComments;
    setShowComments(newVisibility);
    if (onToggleVisibility) {
      onToggleVisibility();
    }
    
    // Refresh comments when opening if there was an error before
    if (newVisibility && error) {
      refreshComments();
    }
  };
  
  const handleRetry = () => {
    refreshComments();
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
      
      {showComments && (
        <div className="mt-4">
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
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Failed to load comments</AlertTitle>
              <AlertDescription className="flex justify-between items-center">
                <span>Please try again later.</span>
                <Button
                  size="sm" 
                  onClick={handleRetry}
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
            error={error}
          />
        </div>
      )}
    </div>
  );
};

export default Comments;
