
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { CommentWithUser } from '@/hooks/comments/types';
import CommentItem from './CommentItem';
import CommentInput from './CommentInput';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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
  error: Error | null;
}

const CommentSkeleton = () => (
  <div className="flex gap-2">
    <Skeleton className="h-8 w-8 rounded-full" />
    <div className="flex-1">
      <Skeleton className="h-24 w-full rounded-lg mb-2" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  </div>
);

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
  parentId,
  error
}) => {
  // Determine if we should show empty state - only when not loading, no comments, and no error
  const showEmptyState = !isLoading && comments.length === 0 && !error;
  
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
      
      <CommentInput 
        onSubmit={onReply} 
        placeholder={isViewingReplies ? "Add a reply..." : "Add a comment..."} 
        autoFocus={isViewingReplies}
      />
      
      <div className="space-y-4 mt-4">
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error loading comments</AlertTitle>
            <AlertDescription>
              {error.message || "Failed to load comments. Please try again later."}
            </AlertDescription>
          </Alert>
        ) : isLoading && comments.length === 0 ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <CommentSkeleton key={i} />
            ))}
          </div>
        ) : showEmptyState ? (
          <div className="text-muted-foreground text-center py-6 border border-dashed rounded-md">
            <p>
              {isViewingReplies 
                ? "No replies yet. Be the first to reply!" 
                : "No comments yet. Be the first to comment!"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onLike={() => onLike(comment.id)}
                onEdit={(content) => onEdit(comment.id, content)}
                onDelete={() => onDelete(comment.id)}
                onViewReplies={() => onViewReplies(comment.id)}
                isReply={isViewingReplies}
              />
            ))}
          </div>
        )}
        
        {isLoading && comments.length > 0 && (
          <div className="space-y-4 mt-4">
            {Array(2).fill(0).map((_, i) => (
              <CommentSkeleton key={`loading-more-${i}`} />
            ))}
          </div>
        )}
        
        {hasMore && !isLoading && comments.length > 0 && !error && (
          <div className="flex justify-center py-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onLoadMore}
              className="min-w-[120px]"
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
