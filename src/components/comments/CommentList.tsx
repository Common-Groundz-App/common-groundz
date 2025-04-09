
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { CommentWithUser } from '@/hooks/comments/types';
import CommentItem from './CommentItem';
import CommentInput from './CommentInput';

interface CommentListProps {
  comments: CommentWithUser[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onLike: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => Promise<boolean>;
  onDelete: (commentId: string) => Promise<boolean>;
  onReply: (content: string) => Promise<CommentWithUser | null>;
  onViewReplies: (commentId: string) => void;
  isViewingReplies: boolean;
  onBackToMainComments: () => void;
  parentId: string | null;
}

const CommentList: React.FC<CommentListProps> = ({
  comments,
  isLoading,
  hasMore,
  onLoadMore,
  onLike,
  onEdit,
  onDelete,
  onReply,
  onViewReplies,
  isViewingReplies,
  onBackToMainComments,
  parentId
}) => {
  return (
    <div className="space-y-4">
      {isViewingReplies && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBackToMainComments}
          className="mb-2 flex items-center gap-1"
        >
          <ChevronLeft size={16} />
          Back to comments
        </Button>
      )}
      
      <CommentInput onSubmit={onReply} placeholder={isViewingReplies ? "Add a reply..." : "Add a comment..."} />
      
      <div className="space-y-4 mt-4">
        {comments.length === 0 && !isLoading ? (
          <p className="text-muted-foreground text-center py-4">
            {isViewingReplies 
              ? "No replies yet. Be the first to reply!" 
              : "No comments yet. Be the first to comment!"}
          </p>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onLike={() => onLike(comment.id)}
              onEdit={(content) => onEdit(comment.id, content)}
              onDelete={() => onDelete(comment.id)}
              onViewReplies={() => onViewReplies(comment.id)}
              isReply={isViewingReplies}
            />
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        )}
        
        {hasMore && !isLoading && comments.length > 0 && (
          <div className="flex justify-center py-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onLoadMore}
            >
              Load more {isViewingReplies ? 'replies' : 'comments'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentList;
