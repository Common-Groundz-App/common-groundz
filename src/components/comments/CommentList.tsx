
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { Comment } from '@/types/comment';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import CommentItem from './CommentItem';
import CommentInput from './CommentInput';

interface CommentListProps {
  comments: Comment[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onAddComment: (content: string) => Promise<any>;
  onLike: (id: string) => void;
  onEdit: (id: string, content: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onViewReplies?: (id: string) => void;
  onBackToMain?: () => void;
  isViewingReplies?: boolean;
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

export default function CommentList({
  comments,
  loading,
  error,
  hasMore,
  onLoadMore,
  onAddComment,
  onLike,
  onEdit,
  onDelete,
  onViewReplies,
  onBackToMain,
  isViewingReplies = false
}: CommentListProps) {
  // Determine if we should show empty state
  const showEmptyState = !loading && comments.length === 0 && !error;
  
  return (
    <div className="space-y-4">
      <AnimatePresence>
        {isViewingReplies && onBackToMain && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBackToMain}
              className="mb-2 flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              Back to comments
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <CommentInput 
        onSubmit={onAddComment} 
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
        ) : loading && comments.length === 0 ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <CommentSkeleton key={i} />
            ))}
          </div>
        ) : showEmptyState ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-center py-6 border border-dashed rounded-md"
          >
            <p>
              {isViewingReplies 
                ? "No replies yet. Be the first to reply!" 
                : "No comments yet. Be the first to comment!"}
            </p>
          </motion.div>
        ) : (
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onLike={() => onLike(comment.id)}
                onEdit={(content) => onEdit(comment.id, content)}
                onDelete={() => onDelete(comment.id)}
                onViewReplies={onViewReplies ? () => onViewReplies(comment.id) : undefined}
                isReply={isViewingReplies}
              />
            ))}
          </motion.div>
        )}
        
        {loading && comments.length > 0 && (
          <div className="space-y-4 mt-4">
            {Array(2).fill(0).map((_, i) => (
              <CommentSkeleton key={`loading-more-${i}`} />
            ))}
          </div>
        )}
        
        <AnimatePresence>
          {hasMore && !loading && comments.length > 0 && !error && (
            <motion.div 
              className="flex justify-center py-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onLoadMore}
                className="min-w-[120px]"
              >
                Load more {isViewingReplies ? 'replies' : 'comments'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
