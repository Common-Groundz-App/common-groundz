import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { feedbackActions } from '@/services/feedbackService';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
}

interface CommentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'post' | 'recommendation';
  onCommentAdded?: () => void;
  highlightCommentId?: string | null;
}

const CommentDialog: React.FC<CommentDialogProps> = ({
  isOpen,
  onClose,
  itemId,
  itemType,
  onCommentAdded,
  highlightCommentId
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch comments when dialog opens
  useEffect(() => {
    if (isOpen && itemId) {
      fetchComments();
    }
  }, [isOpen, itemId, itemType]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const tableName = itemType === 'post' ? 'post_comments' : 'recommendation_comments';
      const foreignKey = itemType === 'post' ? 'post_id' : 'recommendation_id';
      
      // Simplified query to avoid type instantiation issues
      const { data, error } = await supabase
        .from(tableName)
        .select('id, content, created_at, user_id')
        .eq(foreignKey, itemId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately to avoid complex joins
      const userIds = data?.map(comment => comment.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const formattedComments = data?.map(comment => {
        const profile = profiles?.find(p => p.id === comment.user_id);
        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          user_id: comment.user_id,
          username: profile?.username || 'Anonymous',
          avatar_url: profile?.avatar_url
        };
      }) || [];

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const tableName = itemType === 'post' ? 'post_comments' : 'recommendation_comments';
      
      // Create the insert data with the correct structure for each table type
      let insertData: any;
      if (itemType === 'post') {
        insertData = {
          post_id: itemId,
          user_id: user.id,
          content: newComment.trim()
        };
      } else {
        insertData = {
          recommendation_id: itemId,
          user_id: user.id,
          content: newComment.trim()
        };
      }

      const { data, error } = await supabase
        .from(tableName)
        .insert(insertData)
        .select('id, content, created_at, user_id')
        .single();

      if (error) throw error;

      // Add the new comment to the list
      const newCommentWithProfile = {
        ...data,
        username: user.user_metadata?.username || user.email || 'You',
        avatar_url: user.user_metadata?.avatar_url
      };

      setComments(prev => [...prev, newCommentWithProfile]);
      setNewComment('');
      
      // Trigger haptic and sound feedback for comment submission
      try {
        feedbackActions.comment();
      } catch (error) {
        console.error('Error triggering comment feedback:', error);
      }
      
      if (onCommentAdded) {
        onCommentAdded();
      }

      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully'
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Comments
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map(comment => (
              <div 
                key={comment.id} 
                className={`flex gap-3 p-3 rounded-lg ${
                  highlightCommentId === comment.id 
                    ? 'bg-yellow-50 border-2 border-yellow-200' 
                    : 'bg-muted/50'
                }`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={comment.avatar_url} alt={comment.username} />
                  <AvatarFallback>
                    {comment.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{comment.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
        
        {user && (
          <div className="border-t pt-4 space-y-3">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Press Cmd/Ctrl + Enter to post
              </span>
              <Button 
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSubmitting}
                size="sm"
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommentDialog;
