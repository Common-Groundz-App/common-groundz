
import React, { useState, useEffect } from 'react';
import { CommentTarget, Comment } from '@/hooks/comments/types';
import { CommentItem } from './CommentItem';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchComments } from '@/hooks/comments/api';

interface CommentRepliesListProps {
  commentId: string;
  target: CommentTarget;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
}

export const CommentRepliesList = ({ 
  commentId, 
  target, 
  onReply, 
  onEdit, 
  onDelete 
}: CommentRepliesListProps) => {
  const [replies, setReplies] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadReplies = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch replies for this comment
        const fetchedReplies = await fetchComments({ 
          target, 
          parent_id: commentId
        });
        
        setReplies(fetchedReplies);
      } catch (err) {
        console.error('Error loading replies:', err);
        setError('Failed to load replies');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadReplies();
  }, [commentId, target]);
  
  if (error) {
    return (
      <div className="ml-6 mt-3 pl-4 border-l-2 border-muted text-sm text-destructive">
        {error}
      </div>
    );
  }
  
  return (
    <div className="ml-6 mt-3 space-y-3 border-l-2 border-muted pl-4">
      {isLoading ? (
        <div className="py-2">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : replies.map(reply => (
        <CommentItem 
          key={reply.id}
          comment={reply}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          isReply={true}
        />
      ))}
      
      {!isLoading && replies.length === 0 && (
        <div className="py-2 text-sm text-muted-foreground">
          No replies yet
        </div>
      )}
    </div>
  );
};
