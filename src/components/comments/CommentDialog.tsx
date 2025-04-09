
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface Comment {
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
  itemType: 'recommendation' | 'post';
  onCommentAdded?: () => void;
}

const CommentDialog = ({ isOpen, onClose, itemId, itemType, onCommentAdded }: CommentDialogProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && itemId) {
      fetchComments();
    }
  }, [isOpen, itemId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const tableName = itemType === 'recommendation' ? 'recommendation_comments' : 'post_comments';
      const idField = itemType === 'recommendation' ? 'recommendation_id' : 'post_id';
      
      const { data, error } = await supabase
        .from(tableName)
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq(idField, itemId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedComments = data.map(comment => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user_id: comment.user_id,
        username: comment.profiles?.username || 'Unknown user',
        avatar_url: comment.profiles?.avatar_url
      }));

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error loading comments",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive"
      });
      return;
    }

    if (!newComment.trim()) return;
    
    setIsSending(true);
    try {
      const tableName = itemType === 'recommendation' ? 'recommendation_comments' : 'post_comments';
      const idField = itemType === 'recommendation' ? 'recommendation_id' : 'post_id';
      
      // Insert the comment
      const { error: insertError } = await supabase
        .from(tableName)
        .insert({
          [idField]: itemId,
          user_id: user.id,
          content: newComment.trim()
        });

      if (insertError) throw insertError;

      // Increment comment count
      await supabase
        .rpc('increment_comment_count', { 
          table_name: itemType === 'recommendation' ? 'recommendations' : 'posts', 
          item_id: itemId 
        });

      // Clear the input and refresh comments
      setNewComment('');
      fetchComments();
      
      // Notify parent component
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
        title: "Error adding comment",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-96">
          <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Loading comments...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={comment.avatar_url || undefined} />
                      <AvatarFallback>{comment.username?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{comment.username}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <Separator className="my-4" />
          
          <div className="flex flex-col gap-2">
            <Textarea 
              placeholder="Add a comment..." 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={!user || isSending}
              className="min-h-20"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                onClick={handleAddComment} 
                disabled={!newComment.trim() || isSending || !user}
              >
                {isSending ? "Sending..." : "Comment"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommentDialog;
