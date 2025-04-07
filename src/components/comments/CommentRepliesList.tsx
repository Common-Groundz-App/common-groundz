
import React, { useState, useEffect } from 'react';
import { CommentTarget, Comment } from '@/hooks/comments/types';
import { CommentItem } from './CommentItem';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchComments } from '@/hooks/comments/api';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

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
  const [errorVisible, setErrorVisible] = useState(false);
  
  const loadReplies = async () => {
    setIsLoading(true);
    setError(null);
    setErrorVisible(false);
    
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
      setErrorVisible(true);
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setErrorVisible(false);
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadReplies();
  }, [commentId, target]);
  
  const handleRetry = () => {
    loadReplies();
  };
  
  return (
    <div className="ml-6 mt-3 space-y-3 border-l-2 border-muted pl-4">
      {errorVisible && error && (
        <div className="flex items-center justify-between py-2 text-sm text-destructive">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>{error}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetry}
            className="ml-2"
          >
            Retry
          </Button>
        </div>
      )}
      
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
      
      {!isLoading && !error && replies.length === 0 && (
        <div className="py-2 text-sm text-muted-foreground">
          No replies yet
        </div>
      )}
    </div>
  );
};
