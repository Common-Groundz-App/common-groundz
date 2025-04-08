
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle } from 'lucide-react';
import { useComments } from '@/hooks/use-comments';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';
import CommentRepliesList from './CommentRepliesList';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface CommentsListProps {
  itemId: string;
  itemType: 'post' | 'recommendation';
  onCommentAdded?: () => void;
  onCommentCountUpdate?: (count: number) => void;
}

const CommentsList = ({ 
  itemId, 
  itemType, 
  onCommentAdded,
  onCommentCountUpdate 
}: CommentsListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentExpanded, setCommentExpanded] = useState<boolean>(false);
  
  const {
    comments,
    loading,
    error,
    hasMore,
    loadMore,
    addComment,
    updateCommentContent,
    removeComment,
    loadReplies,
    toggleReplies,
    totalCount
  } = useComments({
    itemId,
    itemType
  });

  // Report the actual comment count to parent component whenever it changes
  useEffect(() => {
    if (onCommentCountUpdate && totalCount !== undefined) {
      onCommentCountUpdate(totalCount);
    }
  }, [totalCount, onCommentCountUpdate]);

  const handleAddComment = async (content: string) => {
    try {
      const success = await addComment(content);
      if (success) {
        if (onCommentAdded) {
          onCommentAdded();
        }
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add comment. Please try again.',
          variant: 'destructive',
        });
      }
      return success;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const success = await removeComment(commentId);
      if (!success) {
        toast({
          title: 'Error',
          description: 'Failed to delete comment. Please try again.',
          variant: 'destructive',
        });
      }
      return success;
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertDescription>
          Error loading comments. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate total visible comments (including replies that are loaded)
  const visibleCommentsCount = comments.reduce((total, comment) => {
    // Count the comment itself
    let count = 1;
    // Add any loaded replies
    if (comment.showReplies && comment.replies) {
      count += comment.replies.length;
    }
    return total + count;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Comments 
          <span className="text-muted-foreground">
            {totalCount > 0 && `(${totalCount})`}
          </span>
        </h3>
        
        {user ? (
          <CommentForm 
            onSubmit={handleAddComment}
            placeholder={commentExpanded ? "What are your thoughts?" : "Add a comment..."}
            buttonText="Post Comment"
          />
        ) : (
          <div className="border p-4 rounded-md bg-muted/30 text-center text-sm text-muted-foreground">
            Please sign in to add comments.
          </div>
        )}
      </div>
      
      {comments.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          No comments yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map(comment => (
            <div key={comment.id} className="space-y-2">
              <CommentItem
                comment={comment}
                onReply={addComment}
                onUpdate={updateCommentContent}
                onDelete={handleDeleteComment}
              />
              
              <CommentRepliesList
                comment={comment}
                onReply={addComment}
                onUpdate={updateCommentContent}
                onDelete={handleDeleteComment}
                onToggleReplies={toggleReplies}
                onLoadMoreReplies={loadReplies}
              />
            </div>
          ))}
          
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                className="text-sm"
              >
                Load more comments
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentsList;
