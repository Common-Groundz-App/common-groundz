
import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CommentWithUser } from '@/types/comments';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';
import { Skeleton } from '@/components/ui/skeleton';

interface CommentsListProps {
  comments: CommentWithUser[];
  repliesMap: Map<string, CommentWithUser[]>;
  loading: boolean;
  loadingReplies: string[];
  hasLoadedReplies: (commentId: string) => boolean;
  onAddComment: (content: string, parentId: string | null) => Promise<void>;
  onEditComment: (id: string, content: string) => Promise<void>;
  onDeleteComment: (id: string) => void;
  onLikeComment: (id: string, isLiked: boolean) => void;
  onLoadReplies: (commentId: string) => void;
}

export const CommentsList: React.FC<CommentsListProps> = ({
  comments,
  repliesMap,
  loading,
  loadingReplies,
  hasLoadedReplies,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onLikeComment,
  onLoadReplies
}) => {
  const { user } = useAuth();
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  
  const handleReply = useCallback((commentId: string) => {
    setReplyingToId(commentId === replyingToId ? null : commentId);
  }, [replyingToId]);
  
  const toggleReplies = useCallback((commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);
  
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {user && (
        <CommentForm
          onSubmit={content => onAddComment(content, null)}
          placeholder="Write a comment..."
        />
      )}
      
      {comments.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map(comment => (
            <div key={comment.id} className="space-y-4">
              <CommentItem
                comment={comment}
                onReply={handleReply}
                onEdit={onEditComment}
                onDelete={onDeleteComment}
                onLike={onLikeComment}
                onLoadReplies={onLoadReplies}
                isReplyOpen={replyingToId === comment.id}
                hasReplies={comment.replies_count > 0}
                repliesLoaded={hasLoadedReplies(comment.id)}
                isLoadingReplies={loadingReplies.includes(comment.id)}
                showReplies={expandedComments.has(comment.id)}
                onToggleReplies={() => toggleReplies(comment.id)}
              />
              
              {expandedComments.has(comment.id) && hasLoadedReplies(comment.id) && (
                <div className="ml-8 pl-4 border-l space-y-4">
                  {repliesMap.get(comment.id)?.map(reply => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      onReply={handleReply}
                      onEdit={onEditComment}
                      onDelete={onDeleteComment}
                      onLike={(id, isLiked) => onLikeComment(id, isLiked)}
                      onLoadReplies={() => {}} // Replies to replies not supported for simplicity
                      isReplyOpen={replyingToId === reply.id}
                      hasReplies={false}
                      repliesLoaded={false}
                      isLoadingReplies={false}
                      showReplies={false}
                      onToggleReplies={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentsList;
