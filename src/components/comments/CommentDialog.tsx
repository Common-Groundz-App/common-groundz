
import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { fetchComments, addComment, deleteComment, updateComment, CommentData } from '@/services/commentsService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, MessageCircle, Send } from 'lucide-react';
import { fetchUserProfile } from '@/services/profileService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import UsernameLink from '@/components/common/UsernameLink';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [dialogClosing, setDialogClosing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ avatar_url?: string; username?: string }>({});
  
  const commentToDeleteRef = useRef<string | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          const profileData = await fetchUserProfile(user.id);
          setUserProfile(profileData);
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      }
    };
    
    loadUserProfile();
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      const timeout = setTimeout(() => {
        setIsDeleting(false);
        setDeleteDialogOpen(false);
        setEditingCommentId(null);
        setEditCommentContent('');
        setIsEditing(false);
        setDialogClosing(false);
        commentToDeleteRef.current = null;
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

  const handleDeleteClick = (commentId: string) => {
    commentToDeleteRef.current = commentId;
    console.log("Delete button clicked for comment:", commentId, "Stored in ref:", commentToDeleteRef.current);
    
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const commentId = commentToDeleteRef.current;
    
    console.log("Delete confirmation triggered for comment:", commentId);
    
    if (!user || !commentId) {
      console.error("Missing user or comment ID for deletion");
      return;
    }
    
    setIsDeleting(true);
    
    try {
      console.log("Starting deletion process for:", commentId, itemType, user.id);
      
      const success = await deleteComment(commentId, itemType, user.id);
      
      if (!success) {
        console.error("Delete operation failed");
        throw new Error("Failed to delete comment");
      }
      
      console.log("Delete success:", success);
      
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      
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
      console.error('Error in delete confirmation handler:', error);
      toast({
        title: "Error deleting comment",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      commentToDeleteRef.current = null;
    }
  };

  const handleDeleteCancel = () => {
    console.log("Delete cancelled");
    setDeleteDialogOpen(false);
  };

  const handleCloseDialog = () => {
    if (isDeleting) {
      console.log("Attempted to close dialog while delete in progress, delaying");
      setDialogClosing(true);
      return;
    }
    
    if (deleteDialogOpen) {
      setDeleteDialogOpen(false);
    }
    
    if (editingCommentId) {
      setEditingCommentId(null);
      setEditCommentContent('');
    }
    
    onClose();
  };

  useEffect(() => {
    if (dialogClosing && !isDeleting) {
      console.log("Delayed dialog close now happening");
      onClose();
      setDialogClosing(false);
    }
  }, [dialogClosing, isDeleting, onClose]);

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: false });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const isCurrentUserComment = (userId: string) => {
    return user && user.id === userId;
  };
  
  const getInitials = (name: string | undefined) => {
    if (!name) return user?.email?.substring(0, 1).toUpperCase() || '?';
    return name.charAt(0).toUpperCase();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md md:max-w-lg bg-white rounded-xl border-none shadow-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MessageCircle className="h-5 w-5 text-primary" />
              Comments
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-1 pr-4 -mr-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <div className="animate-pulse flex space-x-2">
                    <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full"></div>
                  </div>
                  <p className="mt-2 text-sm">Loading comments...</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm">No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-3 pt-2 pb-4">
                  {comments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className={`relative group flex gap-3 p-3 rounded-lg transition-colors ${
                        editingCommentId === comment.id ? "bg-gray-50" : ""
                      }`}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={comment.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(comment.username)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <UsernameLink 
                                username={comment.username}
                                userId={comment.user_id}
                                className="text-sm"
                              />
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            
                            {editingCommentId === comment.id ? (
                              <div className="mt-1">
                                <Textarea
                                  value={editCommentContent}
                                  onChange={(e) => setEditCommentContent(e.target.value)}
                                  className="min-h-[60px] text-sm resize-none bg-gray-50 border-gray-200 focus:border-primary focus:ring-0 focus-visible:ring-0"
                                  placeholder="Edit your comment..."
                                  disabled={isEditing}
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-muted-foreground"
                                    onClick={handleEditCancel}
                                    disabled={isEditing}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="default"
                                    size="sm"
                                    onClick={handleEditSave}
                                    disabled={isEditing || !editCommentContent.trim()}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm break-words">{comment.content}</p>
                            )}
                          </div>
                          
                          {isCurrentUserComment(comment.user_id) && editingCommentId !== comment.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal size={14} />
                                  <span className="sr-only">More options</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleEditClick(comment)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteClick(comment.id)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            <Separator className="my-3" />
            
            <div className="relative flex gap-2 items-start">
              <Avatar className="h-8 w-8 mt-1">
                <AvatarImage src={userProfile?.avatar_url} />
                <AvatarFallback>{getInitials(userProfile?.username)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={!user || isSending}
                  className="min-h-[60px] pr-10 resize-none bg-gray-50 border border-gray-200 focus:border-primary focus:ring-0 focus-visible:ring-0 rounded-lg"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 bottom-2 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isSending || !user}
                >
                  <Send size={18} className={isSending ? "animate-pulse" : ""} />
                  <span className="sr-only">Send comment</span>
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
          }
        }}
      >
        <AlertDialogContent className="bg-white rounded-xl border-none shadow-lg max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">Delete Comment?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              This action cannot be undone. Are you sure you want to permanently delete this comment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-center gap-2">
            <AlertDialogCancel 
              onClick={handleDeleteCancel} 
              disabled={isDeleting}
              className="border-gray-200 hover:bg-gray-100 hover:text-gray-900"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 bg-white rounded-full animate-ping"></span>
                    Deleting...
                  </span>
                </>
              ) : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CommentDialog;
