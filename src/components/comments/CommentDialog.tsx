
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { feedbackActions } from '@/services/feedbackService';
import UsernameLink from '@/components/common/UsernameLink';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  is_deleted: boolean;
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

  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true);
      try {
        const tableName = itemType === 'post' ? 'post_comments' : 'recommendation_comments';
        const columnName = itemType === 'post' ? 'post_id' : 'recommendation_id';

        // First get comments
        const { data: commentsData, error: commentsError } = await supabase
          .from(tableName)
          .select('id, content, created_at, user_id, is_deleted')
          .eq(columnName, itemId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });

        if (commentsError) throw commentsError;

        // Then get user profiles for those comments
        const userIds = commentsData?.map(comment => comment.user_id) || [];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // Combine the data
        const enrichedComments: Comment[] = (commentsData || []).map((comment) => {
          const profile = profilesData?.find(p => p.id === comment.user_id);
          return {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            user_id: comment.user_id,
            username: profile?.username || 'Anonymous',
            avatar_url: profile?.avatar_url || undefined,
            is_deleted: comment.is_deleted
          };
        });

        setComments(enrichedComments);
      } catch (error) {
        console.error('Error fetching comments:', error);
        toast({
          title: 'Error',
          description: 'Failed to load comments. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, itemId, itemType, toast]);

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;
    
    setIsSubmitting(true);
    try {
      const tableName = itemType === 'post' ? 'post_comments' : 'recommendation_comments';
      
      let insertData;
      if (itemType === 'post') {
        insertData = {
          user_id: user.id,
          content: newComment.trim(),
          post_id: itemId
        };
      } else {
        insertData = {
          user_id: user.id,
          content: newComment.trim(),
          recommendation_id: itemId
        };
      }
      
      const { data, error } = await supabase
        .from(tableName)
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Trigger feedback for comment submission
      feedbackActions.comment();

      // Add new comment to the list
      const newCommentData: Comment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: user.id,
        username: user.user_metadata?.display_name || user.user_metadata?.username || 'Anonymous',
        avatar_url: user.user_metadata?.avatar_url,
        is_deleted: false
      };
      
      setComments(prev => [...prev, newCommentData]);
      setNewComment('');
      
      // Trigger comment count refresh
      const eventName = itemType === 'post' ? 'refresh-post-comment-count' : 'refresh-recommendation-comment-count';
      window.dispatchEvent(new CustomEvent(eventName, { detail: { itemId } }));
      
      if (onCommentAdded) {
        onCommentAdded();
      }
      
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully.'
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write your comment here..."
            className="mb-2 resize-none"
          />
          <Button
            onClick={handleSubmitComment}
            disabled={isSubmitting || !newComment.trim()}
            className="absolute right-2 bottom-2 rounded-full"
            size="icon"
          >
            {isSubmitting ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Post comment</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center">
            <Loader className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div 
                key={comment.id}
                className={cn(
                  "flex items-start space-x-3 rounded-md p-2 hover:bg-accent transition-colors",
                  highlightCommentId === comment.id && "bg-brand-orange/20"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.avatar_url || undefined} alt={comment.username || 'User'} />
                  <AvatarFallback>{getInitials(comment.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <UsernameLink username={comment.username} userId={comment.user_id} className="text-sm font-medium leading-none" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {formatRelativeDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommentDialog;
