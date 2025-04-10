
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fetchComments, addComment, editComment, deleteComment, CommentData } from '@/services/commentsService';
import { Pencil, Trash2, Check, X } from 'lucide-react';

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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

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

  const handleStartEdit = (comment: CommentData) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editingContent.trim()) return;
    
    try {
      const success = await editComment(commentId, itemType, editingContent);
      
      if (!success) throw new Error("Failed to edit comment");
      
      // Update the comment in the local state
      setComments(comments.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, content: editingContent };
        }
        return comment;
      }));
      
      // Reset editing state
      setEditingCommentId(null);
      setEditingContent('');
      
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully"
      });
    } catch (error) {
      console.error('Error editing comment:', error);
      toast({
        title: "Error updating comment",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const handleOpenDeleteDialog = (commentId: string) => {
    setCommentToDelete(commentId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!commentToDelete) return;
    
    try {
      const success = await deleteComment(commentToDelete, itemId, itemType);
      
      if (!success) throw new Error("Failed to delete comment");
      
      // Remove the comment from the local state
      setComments(comments.filter(comment => comment.id !== commentToDelete));
      
      // Close the delete dialog
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
      
      // Trigger a feed refresh event to update comment counts across the app
      const refreshEventName = `refresh-${itemType}-comment-count`;
      const refreshEvent = new CustomEvent(refreshEventName, { detail: { itemId } });
      window.dispatchEvent(refreshEvent);
      
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error deleting comment",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy h:mm a');
  };

  const isCommentOwner = (commentUserId: string) => {
    return user && user.id === commentUserId;
  };

  return (
    <>
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
                          <div className="flex items-center gap-2">
                            {isCommentOwner(comment.user_id) && editingCommentId !== comment.id && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6" 
                                  onClick={() => handleStartEdit(comment)}
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-destructive" 
                                  onClick={() => handleOpenDeleteDialog(comment.id)}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(comment.created_at)}
                            </span>
                          </div>
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="mt-1">
                            <Textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="min-h-20 text-sm"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-xs"
                                onClick={handleCancelEdit}
                              >
                                <X size={14} className="mr-1" /> Cancel
                              </Button>
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSaveEdit(comment.id)}
                                disabled={!editingContent.trim()}
                              >
                                <Check size={14} className="mr-1" /> Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm">{comment.content}</p>
                        )}
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
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CommentDialog;
