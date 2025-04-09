
import React, { useState } from 'react';
import { CommentWithUser } from '@/types/comments';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';

interface CommentsListProps {
  comments: CommentWithUser[];
  repliesMap: Record<string, CommentWithUser[]>;
  loading: boolean;
  loadingReplies: Record<string, boolean>;
  hasLoadedReplies: Record<string, boolean>;
  onAddComment: (content: string, parentId?: string | null) => Promise<any>;
  onEditComment: (commentId: string, content: string, parentId?: string | null) => Promise<any>;
  onDeleteComment: (commentId: string, parentId?: string | null) => Promise<void>;
  onLikeComment: (commentId: string, isLiked: boolean, parentId?: string | null) => Promise<void>;
  onLoadReplies: (commentId: string) => Promise<void>;
}

const CommentsList: React.FC<CommentsListProps> = ({
  comments = [],
  repliesMap = {},
  loading = false,
  loadingReplies = {},
  hasLoadedReplies = {},
  onAddComment,
  onEditComment,
  onDeleteComment,
  onLikeComment,
  onLoadReplies,
}) => {
  const { user } = useAuth();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  
  const handleAddComment = async (content: string) => {
    await onAddComment(content);
  };
  
  const handleAddReply = async (content: string, parentId: string) => {
    await onAddComment(content, parentId);
    setReplyingTo(null);
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex space-x-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted"></div>
            <div className="flex-1 py-1 space-y-2">
              <div className="h-4 w-1/4 bg-muted rounded"></div>
              <div className="h-3 bg-muted rounded"></div>
              <div className="h-3 w-3/4 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-5">
      {user && (
        <CommentForm 
          onSubmit={handleAddComment}
          placeholder="Add a comment..."
        />
      )}
      
      {comments.length > 0 ? (
        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-5 py-1">
            {comments.map((comment) => (
              <CommentItem 
                key={comment.id}
                comment={comment}
                onEdit={(content) => onEditComment(comment.id, content)}
                onDelete={() => onDeleteComment(comment.id)}
                onLike={() => onLikeComment(comment.id, comment.is_liked)}
                onReply={() => setReplyingTo(comment.id)}
                isReplying={replyingTo === comment.id}
                onCancelReply={() => setReplyingTo(null)}
                onSubmitReply={(content) => handleAddReply(content, comment.id)}
                replies={repliesMap[comment.id] || []}
                isLoadingReplies={loadingReplies[comment.id] || false}
                hasLoadedReplies={hasLoadedReplies[comment.id] || false}
                onLoadReplies={() => onLoadReplies(comment.id)}
              />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {user ? 'Be the first to comment!' : 'No comments yet.'}
        </div>
      )}
    </div>
  );
};

export default CommentsList;
