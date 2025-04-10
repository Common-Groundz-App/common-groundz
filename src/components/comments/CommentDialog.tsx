
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fetchComments, addComment, deleteComment, CommentData } from '@/services/commentsService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface CommentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'recommendation' | 'post';
  onCommentAdded?: () => void;
}

const CommentDialog = ({ isOpen, onClose, itemId, itemType, onCommentAdded }: CommentDialogProps) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to ensure proper cleanup after animations
      const timeout = setTimeout(() => {
        setCommentToDelete(null);
        setIsDeleting(false);
        setDeleteDialogOpen(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && itemId) {
      loadComments();
    }
  }, [isOpen, itemId]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const commentData = await fetchComments(itemId, itemType);
      setComments(commentData);
    } catch (error) {
      console.error('Error loading comments:', error);
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
      const success = await addComment(itemId, itemType, newComment, user.id);
      
      if (!success) throw new Error("Failed to add comment");

      // Clear the input and refresh comments
      setNewComment('');
      loadComments();
      
      // Notify parent component
      if (onCommentAdded) {
        onCommentAdded();
      }

      // Also trigger a feed refresh event to update comment counts across the app
      const refreshEventName = `refresh-${itemType}-comment-count`;
      const refreshEvent = new CustomEvent(refreshEventName, { detail: { itemId } });
      window.dispatchEvent(refreshEvent);

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

  const handleDeleteClick = (commentId: string) => {
    setCommentToDelete(commentId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user || !commentToDelete) {
      console.error("Missing user or comment ID for deletion");
      return;
    }
    
    setIsDeleting(true);
    
    try {
      console.log("Deleting comment:", commentToDelete, itemType, user.id);
      const success = await deleteComment(commentToDelete, itemType, user.id);
      
      if (!success) {
        console.error("Delete operation returned false");
        throw new Error("Failed to delete comment");
      }
      
      console.log("Delete success:", success);

      // Remove the deleted comment from local state
      setComments(prev => prev.filter(comment => comment.id !== commentToDelete));
      
      // Trigger refresh event for comment counts
      const refreshEventName = `refresh-${itemType}-comment-count`;
      const refreshEvent = new CustomEvent(refreshEventName, { detail: { itemId } });
      window.dispatchEvent(refreshEvent);
      
      // Notify parent component if needed
      if (onCommentAdded) {
        onCommentAdded();
      }

      toast({
        title: "Comment deleted",
        description: "Your comment has been removed successfully"
      });
      
      // Close the confirmation dialog first
      setDeleteDialogOpen(false);
      
      // Reset deletion state
      setTimeout(() => {
        setCommentToDelete(null);
        setIsDeleting(false);
      }, 100);
      
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error deleting comment",
        description: "Please try again later",
        variant: "destructive"
      });
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCommentToDelete(null);
  };

  const handleCloseDialog = () => {
    // Ensure we first close any delete dialogs if open
    if (deleteDialogOpen) {
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
    }
    
    // Then close the main dialog with a slight delay
    // to ensure any pending state updates are completed
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
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
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(comment.created_at)}
                            </span>
                            {user && user.id === comment.user_id && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteClick(comment.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
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
                <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
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

      <AlertDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteDialogOpen(false);
            setCommentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CommentDialog;
