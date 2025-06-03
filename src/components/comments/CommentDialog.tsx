
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import UsernameLink from '@/components/common/UsernameLink';
import { formatRelativeDate } from '@/utils/dateUtils';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
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
  highlightCommentId = null
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    try {
      const tableName = itemType === 'post' ? 'post_comments' : 'recommendation_comments';
      const idField = itemType === 'post' ? 'post_id' : 'recommendation_id';
      
      const { data, error } = await supabase
        .from(tableName)
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles!inner(username, avatar_url)
        `)
        .eq(idField, itemId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Map the data to our Comment interface
      const mappedComments: Comment[] = (data || []).map(comment => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user_id: comment.user_id,
        username: (comment.profiles as any)?.username || null,
        avatar_url: (comment.profiles as any)?.avatar_url || null
      }));

      setComments(mappedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [isOpen, itemId, itemType]);

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const tableName = itemType === 'post' ? 'post_comments' : 'recommendation_comments';
      const idField = itemType === 'post' ? 'post_id' : 'recommendation_id';
      
      const { error } = await supabase
        .from(tableName)
        .insert({
          content: newComment.trim(),
          [idField]: itemId,
          user_id: user.id
        });

      if (error) throw error;

      setNewComment('');
      await fetchComments();
      
      if (onCommentAdded) {
        onCommentAdded();
      }

      toast({
        title: "Comment added",
        description: "Your comment has been added successfully"
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="text-muted-foreground">Loading comments...</div>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment, index) => (
                  <div 
                    key={comment.id} 
                    className={`space-y-2 ${highlightCommentId === comment.id ? 'bg-accent/50 p-2 rounded-md' : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.avatar_url || undefined} alt={comment.username || 'User'} />
                        <AvatarFallback>{getInitials(comment.username)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <UsernameLink 
                            username={comment.username} 
                            userId={comment.user_id}
                            className="font-medium text-sm"
                          />
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeDate(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mt-1 break-words">{comment.content}</p>
                      </div>
                    </div>
                    {index < comments.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {/* Add Comment Section */}
          {user && (
            <div className="border-t pt-4 mt-4">
              <div className="flex space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.username || 'You'} />
                  <AvatarFallback>{getInitials(user.user_metadata?.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <Textarea
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || isSubmitting}
                      size="sm"
                    >
                      {isSubmitting ? 'Adding...' : 'Add Comment'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommentDialog;
