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
import { fetchComments, addComment, deleteComment, updateComment, CommentData } from '@/services/commentsService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, Trash2, X, Save } from 'lucide-react';

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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [dialogClosing, setDialogClosing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      const timeout = setTimeout(() => {
        setCommentToDelete(null);
        setIsDeleting(false);
        setDeleteDialogOpen(false);
        setEditingCommentId(null);
        setEditCommentContent('');
        setIsEditing(false);
        setDialogClosing(false);
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

      setNewComment('');
      loadComments();
      
      if (onCommentAdded) {
        onCommentAdded();
      }

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

  const handleEditClick = (comment: CommentData) => {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditCommentContent('');
  };

  const handleEditSave = async () => {
    if (!user || !editingCommentId || !editCommentContent.trim()) {
      return;
    }
    
    setIsEditing(true);
    
    try {
      const success = await updateComment(editingCommentId, editCommentContent, itemType, user.id);
      
      if (!success) {
        throw new Error("Failed to update comment");
      }
      
      setComments(prev => prev.map(comment => 
        comment.id === editingCommentId 
          ? { ...comment, content: editCommentContent } 
          : comment
      ));
      
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully"
      });
      
      setEditingCommentId(null);
      setEditCommentContent('');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Error updating comment",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (event: React.MouseEvent, commentId: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log("Delete button clicked for comment:", commentId);
    
    setCommentToDelete(commentId);
    setTimeout(() => {
      setDeleteDialogOpen(true);
    }, 0);
  };

  const handleDeleteConfirm = async () => {
    console.log("Delete confirmation triggered for comment:", commentToDelete);
    
    if (!user || !commentToDelete) {
      console.error("Missing user or comment ID for deletion");
      return;
    }
    
    setIsDeleting(true);
    
    try {
      console.log("Initiating deletion process for:", commentToDelete, itemType, user.id);
      
      const commentIdToDelete = commentToDelete;
      
      setTimeout(async () => {
        try {
          console.log("Executing deletion for comment:", commentIdToDelete);
          const success = await deleteComment(commentIdToDelete, itemType, user.id);
          
          if (!success) {
            console.error("Delete operation returned false");
            throw new Error("Failed to delete comment");
          }
          
          console.log("Delete success:", success);
          
          setComments(prev => prev.filter(comment => comment.id !== commentIdToDelete));
          
          const refreshEventName = `refresh-${itemType}-comment-count`;
          const refreshEvent = new CustomEvent(refreshEventName, { detail: { itemId } });
          window.dispatchEvent(refreshEvent);
          
          if (onCommentAdded) {
            onCommentAdded();
          }
          
          toast({
            title: "Comment deleted",
            description: "Your comment has been removed successfully"
          });
        } catch (error) {
          console.error('Error in delayed deletion:', error);
          toast({
            title: "Error deleting comment",
            description: "Please try again later",
            variant: "destructive"
          });
        } finally {
          setIsDeleting(false);
          setCommentToDelete(null);
        }
      }, 100);
      
      setDeleteDialogOpen(false);
      
    } catch (error) {
      console.error('Error in delete confirmation handler:', error);
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
    console.log("Delete cancelled");
    setDeleteDialogOpen(false);
    setCommentToDelete(null);
  };

  const handleCloseDialog = () => {
    if (isDeleting) {
      console.log("Attempted to close dialog while delete in progress, delaying");
      setDialogClosing(true);
      return;
    }
    
    if (deleteDialogOpen) {
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
    }
    
    if (editingCommentId) {
      setEditingCommentId(null);
      setEditCommentContent('');
    }
    
    setTimeout(() => {
      onClose();
    }, 100);
  };

  useEffect(() => {
    if (dialogClosing && !isDeleting) {
      console.log("Delayed dialog close now happening");
      onClose();
      setDialogClosing(false);
    }
  }, [dialogClosing, isDeleting, onClose]);

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
                              <div className="flex items-center gap-1">
                                {editingCommentId !== comment.id ? (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                                      onClick={() => handleEditClick(comment)}
                                      disabled={isDeleting || isEditing}
                                    >
                                      <Edit size={14} />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={(e) => handleDeleteClick(e, comment.id)}
                                      disabled={isDeleting || isEditing}
                                      data-comment-id={comment.id}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-muted-foreground hover:text-green-500"
                                      onClick={handleEditSave}
                                      disabled={isEditing || !editCommentContent.trim()}
                                    >
                                      <Save size={14} />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                      onClick={handleEditCancel}
                                      disabled={isEditing}
                                    >
                                      <X size={14} />
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="mt-1">
                            <Textarea
                              value={editCommentContent}
                              onChange={(e) => setEditCommentContent(e.target.value)}
                              className="min-h-[60px] text-sm"
                              placeholder="Edit your comment..."
                              disabled={isEditing}
                            />
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
          console.log("AlertDialog onOpenChange:", open);
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
