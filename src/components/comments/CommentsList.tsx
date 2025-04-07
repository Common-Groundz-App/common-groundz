
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CommentTarget } from '@/hooks/comments/types';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments } from '@/hooks/comments/use-comments';
import { CommentsErrorAlert } from './CommentsErrorAlert';
import { CommentRepliesList } from './CommentRepliesList';
import { CommentSkeletons } from './CommentSkeletons';
import { CommentsEmptyState } from './CommentsEmptyState';
import { MessageCircle } from 'lucide-react';

interface CommentsListProps {
  target: CommentTarget;
  className?: string;
}

export const CommentsList = ({ target, className = '' }: CommentsListProps) => {
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string | null } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const { 
    comments, 
    isLoading, 
    loadComments, 
    addComment, 
    editComment, 
    removeComment 
  } = useComments({ 
    target, 
    parentId: null, // Get top-level comments only
    immediate: true,
    onError: (err) => {
      console.error('Error in comments hook:', err);
      setError('Failed to load comments. Please try again.');
    }
  });
  
  const handleRefresh = () => {
    setError(null);
    setRetryCount(prev => prev + 1);
    loadComments();
  };

  const handleCommentSubmit = async (content: string) => {
    setError(null);
    try {
      await addComment(content);
    } catch (err) {
      console.error('Error submitting comment:', err);
      setError('Failed to post comment. Please try again.');
    }
  };

  const handleReplySubmit = async (content: string) => {
    setError(null);
    if (replyingTo) {
      try {
        await addComment(content, replyingTo.id);
        setReplyingTo(null);
      } catch (err) {
        console.error('Error submitting reply:', err);
        setError('Failed to post reply. Please try again.');
      }
    }
  };
  
  // Reset error state when target changes
  React.useEffect(() => {
    setError(null);
  }, [target.id, target.type]);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5" />
        <h3 className="text-lg font-medium">Comments</h3>
      </div>
      
      <CommentsErrorAlert error={error} onRetry={handleRefresh} />
      
      <CommentForm onSubmit={handleCommentSubmit} />
      
      {replyingTo && (
        <div className="ml-8 mt-2">
          <CommentForm 
            onSubmit={handleReplySubmit}
            onCancel={() => setReplyingTo(null)}
            placeholder="Write a reply..."
            buttonText="Reply"
            showCancel={true}
            replyingTo={replyingTo.username || 'Anonymous'}
            autoFocus={true}
          />
        </div>
      )}
      
      <div className="space-y-4 mt-6">
        {isLoading ? (
          <CommentSkeletons count={3} />
        ) : comments.length === 0 ? (
          <CommentsEmptyState />
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="space-y-3">
              <CommentItem 
                comment={comment}
                onReply={(commentId) => {
                  const comment = comments.find(c => c.id === commentId);
                  if (comment) {
                    setReplyingTo({ id: comment.id, username: comment.username });
                  }
                }}
                onEdit={editComment}
                onDelete={removeComment}
                onViewReplies={comment.replies_count ? (() => {
                  // Toggle expanded state
                  setExpandedReplies(prev => ({
                    ...prev,
                    [comment.id]: !prev[comment.id]
                  }));
                }) : undefined}
              />
              
              {/* Display replies if expanded */}
              {expandedReplies[comment.id] && (
                <CommentRepliesList 
                  commentId={comment.id}
                  target={target}
                  onReply={(commentId) => {
                    const comment = comments.find(c => c.id === commentId);
                    if (comment) {
                      setReplyingTo({ id: comment.id, username: comment.username });
                    }
                  }}
                  onEdit={editComment}
                  onDelete={removeComment}
                />
              )}
            </div>
          ))
        )}
      </div>
      
      {!isLoading && comments.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
          >
            Refresh Comments
          </Button>
        </div>
      )}
    </div>
  );
};
