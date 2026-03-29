import React, { useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { useToast } from '@/hooks/use-toast';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { formatDistanceToNow } from 'date-fns';
import { fetchComments, addComment, deleteComment, updateComment, CommentData } from '@/services/commentsService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, MessageCircle, ArrowUp, User } from 'lucide-react';
import { fetchUserProfile } from '@/services/profileService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import UsernameLink from '@/components/common/UsernameLink';
import { feedbackActions } from '@/services/feedbackService';
import { getInitialsFromName } from '@/utils/profileUtils';
import { Skeleton } from '@/components/ui/skeleton';

interface InlineCommentThreadProps {
  itemId: string;
  itemType: 'recommendation' | 'post';
  highlightCommentId?: string | null;
  autoFocusInput?: boolean;
  onCommentCountChange?: (count: number) => void;
}

const InlineCommentThread: React.FC<InlineCommentThreadProps> = ({
  itemId,
  itemType,
  highlightCommentId,
  autoFocusInput = false,
  onCommentCountChange,
}) => {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ avatar_url?: string; username?: string; first_name?: string; last_name?: string }>({});

  const commentToDeleteRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commentSectionRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const { toast } = useToast();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();

  const sortedComments = useMemo(() => {
    if (!user || comments.length === 0) return comments;
    const currentUserComments = comments.filter(c => c.user_id === user.id);
    const otherComments = comments
      .filter(c => c.user_id !== user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return [...currentUserComments, ...otherComments];
  }, [comments, user]);

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
    loadComments();
  }, [itemId]);

  useEffect(() => {
    if (autoFocusInput && !isLoading) {
      setTimeout(() => {
        if (commentSectionRef.current) {
          commentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        textareaRef.current?.focus();
      }, 300);
    }
  }, [autoFocusInput, isLoading]);

  // Scroll to highlighted comment
  useEffect(() => {
    if (highlightCommentId && !isLoading && comments.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`comment-${highlightCommentId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('bg-accent/50');
          setTimeout(() => el.classList.remove('bg-accent/50'), 3000);
        }
      }, 300);
    }
  }, [highlightCommentId, isLoading, comments]);

  const loadComments = async () => {
    if (!itemId) return;
    setIsLoading(true);
    try {
      const commentData = await fetchComments(itemId, itemType);
      setComments(commentData);
      onCommentCountChange?.(commentData.length);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!requireAuth({ action: 'comment', surface: 'inline_comment_thread' })) return;
    if (!canPerformAction('canComment')) {
      showVerificationRequired('canComment');
      return;
    }
    if (!newComment.trim()) return;

    setIsSending(true);
    try {
      const success = await addComment(itemId, itemType, newComment, user.id);
      if (!success) throw new Error("Failed to add comment");

      setNewComment('');
      loadComments();

      const refreshEventName = `refresh-${itemType}-comment-count`;
      window.dispatchEvent(new CustomEvent(refreshEventName, { detail: { itemId } }));

      try { feedbackActions.comment(); } catch {}

      toast({ title: "Comment added", description: "Your comment has been added successfully" });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: "Error adding comment", description: "Please try again later", variant: "destructive" });
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
    if (!user || !editingCommentId || !editCommentContent.trim()) return;
    setIsEditing(true);
    try {
      const success = await updateComment(editingCommentId, editCommentContent, itemType, user.id);
      if (!success) throw new Error("Failed to update comment");

      setComments(prev => prev.map(comment =>
        comment.id === editingCommentId
          ? { ...comment, content: editCommentContent, edited_at: new Date().toISOString() }
          : comment
      ));

      toast({ title: "Comment updated", description: "Your comment has been updated successfully" });
      setEditingCommentId(null);
      setEditCommentContent('');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({ title: "Error updating comment", description: "Please try again later", variant: "destructive" });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (commentId: string) => {
    commentToDeleteRef.current = commentId;
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const commentId = commentToDeleteRef.current;
    if (!user || !commentId) return;

    setIsDeleting(true);
    try {
      const success = await deleteComment(commentId, itemType, user.id);
      if (!success) throw new Error("Failed to delete comment");

      setComments(prev => prev.filter(comment => comment.id !== commentId));
      onCommentCountChange?.(comments.length - 1);

      const refreshEventName = `refresh-${itemType}-comment-count`;
      window.dispatchEvent(new CustomEvent(refreshEventName, { detail: { itemId } }));

      toast({ title: "Comment deleted", description: "Your comment has been removed successfully" });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({ title: "Error deleting comment", description: "Please try again later", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      commentToDeleteRef.current = null;
    }
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: false });
    } catch { return ''; }
  };

  const isCommentEdited = (comment: CommentData) => {
    return comment.edited_at && comment.edited_at !== comment.created_at;
  };

  const isCurrentUserComment = (userId: string) => user && user.id === userId;

  return (
    <div ref={commentSectionRef} className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Comments</h3>
        {!isLoading && <span className="text-xs text-muted-foreground">({comments.length})</span>}
      </div>

      {/* Comment List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedComments.map((comment) => (
            <div
              key={comment.id}
              id={`comment-${comment.id}`}
              className={cn(
                "relative group flex gap-3 p-3 rounded-lg transition-colors",
                editingCommentId === comment.id && "bg-muted/50"
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={comment.avatar_url || undefined} />
                <AvatarFallback className="bg-brand-orange text-white">
                  {getInitialsFromName(comment.displayName || comment.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <UsernameLink
                        username={comment.username}
                        userId={comment.user_id}
                        displayName={comment.displayName}
                        showHandle={false}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{formatRelativeTime(comment.created_at)}</span>
                        {isCommentEdited(comment) && (
                          <>
                            <span>·</span>
                            <span className="italic">Edited</span>
                          </>
                        )}
                      </div>
                    </div>

                    {editingCommentId === comment.id ? (
                      <div className="mt-1">
                        <Textarea
                          value={editCommentContent}
                          onChange={(e) => setEditCommentContent(e.target.value)}
                          className="min-h-[60px] text-sm resize-none bg-muted/30 border focus:border-primary focus:ring-0 focus-visible:ring-0"
                          placeholder="Edit your comment..."
                          disabled={isEditing}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="ghost" size="sm" onClick={handleEditCancel} disabled={isEditing}>
                            Cancel
                          </Button>
                          <Button variant="default" size="sm" onClick={handleEditSave} disabled={isEditing || !editCommentContent.trim()}>
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
                          className="h-7 w-7 text-muted-foreground opacity-50 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal size={14} />
                          <span className="sr-only">More options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => handleEditClick(comment)}>Edit</DropdownMenuItem>
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

      {/* Comment Input */}
      <div className="border-t border-border mt-4 pt-4">
        <div className="flex gap-3 items-center">
          <Avatar className="h-8 w-8 flex-shrink-0">
            {user ? (
              <>
                <AvatarImage src={userProfile?.avatar_url} />
                <AvatarFallback className="bg-brand-orange text-white">
                  {getInitialsFromName([userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || userProfile?.username)}
                </AvatarFallback>
              </>
            ) : (
              <AvatarFallback className="bg-muted text-muted-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            )}
          </Avatar>
          <Textarea
            ref={textareaRef}
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={isSending}
            rows={1}
            className="min-h-[40px] max-h-[120px] flex-1 resize-none bg-muted/50 border-0 focus:ring-0 focus-visible:ring-0 rounded-xl py-2 px-4 text-sm"
            onFocus={() => {
              if (!user) {
                setNewComment('');
                requireAuth({ action: 'comment', surface: 'inline_comment_thread' });
                textareaRef.current?.blur();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <Button
            size="icon"
            className={cn(
              "rounded-full h-8 w-8 flex-shrink-0 transition-colors",
              newComment.trim()
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground"
            )}
            onClick={handleAddComment}
            disabled={!newComment.trim() || isSending}
          >
            <ArrowUp size={16} className={isSending ? "animate-pulse" : ""} />
            <span className="sr-only">Post comment</span>
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open && !isDeleting) setDeleteDialogOpen(false);
      }}>
        <AlertDialogContent className="rounded-xl border-none shadow-lg max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">Delete Comment?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              This action cannot be undone. Are you sure you want to permanently delete this comment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-center gap-2">
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
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
    </div>
  );
};

export default InlineCommentThread;
