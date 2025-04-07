import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Comment } from '@/hooks/comments/types';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments } from '@/hooks/comments/use-comments';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle } from 'lucide-react';
import { fetchComments } from '@/hooks/comments/api';

interface CommentsListProps {
  target: { type: 'post' | 'recommendation'; id: string; };
  className?: string;
}

export const CommentsList = ({ target, className = '' }: CommentsListProps) => {
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string | null } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  
  const { 
    comments, 
    isLoading, 
    loadComments, 
    addComment, 
    editComment, 
    removeComment 
  } = useComments({ 
    target, 
    parentId: null // Get top-level comments only
  });
  
  // Map to track replies for each comment
  const [repliesMap, setRepliesMap] = useState<Record<string, Comment[]>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});
  
  const handleCommentSubmit = async (content: string) => {
    await addComment(content);
  };

  const handleReplySubmit = async (content: string) => {
    if (replyingTo) {
      const newComment = await addComment(content, replyingTo.id);
      
      // Update replies in state if the parent comment's replies are expanded
      if (expandedReplies[replyingTo.id] && newComment) {
        setRepliesMap(prev => ({
          ...prev,
          [replyingTo.id]: [newComment, ...(prev[replyingTo.id] || [])]
        }));
      }
      
      setReplyingTo(null);
    }
  };
  
  const handleViewReplies = async (commentId: string) => {
    // Toggle expanded state
    const newState = !expandedReplies[commentId];
    setExpandedReplies(prev => ({ ...prev, [commentId]: newState }));
    
    // If expanding and we don't have replies loaded yet, fetch them
    if (newState && (!repliesMap[commentId] || repliesMap[commentId].length === 0)) {
      setRepliesLoading(prev => ({ ...prev, [commentId]: true }));
      
      try {
        // Fetch replies for this comment
        const replies = await fetchComments({ 
          target, 
          parent_id: commentId
        });
        
        // Store the loaded replies
        setRepliesMap(prev => ({ 
          ...prev, 
          [commentId]: replies 
        }));
      } catch (error) {
        console.error('Error loading replies:', error);
      } finally {
        setRepliesLoading(prev => ({ ...prev, [commentId]: false }));
      }
    }
  };

  // Handle reply button click
  const handleReply = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      setReplyingTo({ id: comment.id, username: comment.username });
    }
  };
  
  // Handle comment edit
  const handleEdit = (commentId: string, content: string) => {
    editComment(commentId, content);
  };
  
  // Handle comment delete
  const handleDelete = (commentId: string) => {
    removeComment(commentId);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5" />
        <h3 className="text-lg font-medium">Comments</h3>
      </div>
      
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
          // Display skeletons while loading
          Array(3).fill(0).map((_, index) => (
            <div key={index} className="flex space-x-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            </div>
          ))
        ) : comments.length === 0 ? (
          // Empty state
          <div className="text-center py-8">
            <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          // Display comments
          comments.map(comment => (
            <div key={comment.id} className="space-y-3">
              <CommentItem 
                comment={comment}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewReplies={comment.replies_count ? handleViewReplies : undefined}
              />
              
              {/* Display replies if expanded */}
              {expandedReplies[comment.id] && (
                <div className="ml-6 mt-3 space-y-3 border-l-2 border-muted pl-4">
                  {repliesLoading[comment.id] ? (
                    <div className="py-2">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : repliesMap[comment.id]?.map(reply => (
                    <CommentItem 
                      key={reply.id}
                      comment={reply}
                      onReply={handleReply}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isReply={true}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {!isLoading && comments.length > 0 && (
        <div className="flex justify-center mt-4">
          <Button 
            variant="outline" 
            onClick={() => loadComments()}
          >
            Refresh Comments
          </Button>
        </div>
      )}
    </div>
  );
};
