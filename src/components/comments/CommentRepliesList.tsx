
import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommentWithReplies } from '@/types/comment';
import CommentItem from './CommentItem';

interface CommentRepliesListProps {
  comment: CommentWithReplies;
  onReply: (commentId: string, content: string) => Promise<boolean>;
  onUpdate: (commentId: string, content: string) => Promise<boolean>;
  onDelete: (commentId: string) => Promise<boolean>;
  onToggleReplies: (commentId: string) => void;
  onLoadMoreReplies?: (commentId: string) => Promise<void>;
}

const CommentRepliesList = ({
  comment,
  onReply,
  onUpdate,
  onDelete,
  onToggleReplies,
  onLoadMoreReplies
}: CommentRepliesListProps) => {
  const [loadingMoreReplies, setLoadingMoreReplies] = useState(false);
  
  const handleLoadMoreReplies = async () => {
    if (!onLoadMoreReplies || loadingMoreReplies) return;
    
    setLoadingMoreReplies(true);
    try {
      await onLoadMoreReplies(comment.id);
    } finally {
      setLoadingMoreReplies(false);
    }
  };
  
  const hasReplies = (comment.replyCount && comment.replyCount > 0) || 
                     (comment.replies && comment.replies.length > 0);

  if (!hasReplies) return null;
  
  const displayedRepliesCount = comment.replies?.length || 0;
  const hiddenRepliesCount = (comment.replyCount || 0) - displayedRepliesCount;
  const showMoreRepliesButton = hiddenRepliesCount > 0 && comment.showReplies;

  return (
    <div className="mt-2 ml-10">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 mb-2 text-xs flex items-center text-muted-foreground hover:text-foreground"
        onClick={() => onToggleReplies(comment.id)}
        disabled={comment.loadingReplies}
      >
        {comment.loadingReplies ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : comment.showReplies ? (
          <ChevronUp className="mr-1 h-3 w-3" />
        ) : (
          <ChevronDown className="mr-1 h-3 w-3" />
        )}
        {comment.showReplies
          ? 'Hide replies'
          : `Show ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
      </Button>

      {comment.showReplies && comment.replies && (
        <div className="space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
          
          {showMoreRepliesButton && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleLoadMoreReplies}
              disabled={loadingMoreReplies}
            >
              {loadingMoreReplies ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Loading more replies...
                </>
              ) : (
                `Show more replies (${hiddenRepliesCount})`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentRepliesList;
