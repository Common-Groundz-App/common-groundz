
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { useToast } from '@/hooks/use-toast';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { fetchComments, addComment, deleteComment, updateComment, toggleCommentLike, fetchCommentUserReputations, CommentData } from '@/services/commentsService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageCircle, ArrowUp, User } from 'lucide-react';
import { fetchUserProfile } from '@/services/profileService';
import { feedbackActions } from '@/services/feedbackService';
import { getInitialsFromName } from '@/utils/profileUtils';
import { Skeleton } from '@/components/ui/skeleton';
import CommentItem from './CommentItem';
import MentionAutocomplete from './MentionAutocomplete';

interface InlineCommentThreadProps {
  itemId: string;
  itemType: 'recommendation' | 'post';
  highlightCommentId?: string | null;
  autoFocusInput?: boolean;
  onCommentCountChange?: (count: number) => void;
}

interface GroupedComment {
  comment: CommentData;
  replies: CommentData[];
  isDeletedWithReplies: boolean;
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

  // Reply state
  const [replyingTo, setReplyingTo] = useState<CommentData | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionVisible, setMentionVisible] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<'main' | 'reply'>('main');

  // Reputation/badge state
  const [trustedUserIds, setTrustedUserIds] = useState<Set<string>>(new Set());

  const commentToDeleteRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentSectionRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { requireAuth } = useAuthPrompt();
  const { toast } = useToast();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();

  // Group comments into threads
  const groupedComments = useMemo((): GroupedComment[] => {
    if (comments.length === 0) return [];

    const topLevel = comments.filter(c => !c.parent_id);
    const replyMap = new Map<string, CommentData[]>();

    comments.forEach(c => {
      if (c.parent_id) {
        const existing = replyMap.get(c.parent_id) || [];
        existing.push(c);
        replyMap.set(c.parent_id, existing);
      }
    });

    // Sort replies oldest-first within each thread
    replyMap.forEach((replies) => {
      replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    const groups: GroupedComment[] = topLevel.map(comment => ({
      comment,
      replies: replyMap.get(comment.id) || [],
      isDeletedWithReplies: false,
    }));

    // Precompute scores for 5-tier relevance ranking
    const scored = groups.map(g => {
      const hasCircleReply = g.replies.some(r => r.is_from_circle);
      const replyLikes = g.replies.reduce((s, r) => s + (r.like_count || 0), 0);
      return {
        ...g,
        _hasReplies: g.replies.length > 0 ? 1 : 0,
        _circle: g.comment.is_from_circle || hasCircleReply ? 1 : 0,
        _likeScore: Math.min((g.comment.like_count || 0) + Math.floor(replyLikes * 0.5), 20),
        _time: g.comment.created_at ? new Date(g.comment.created_at).getTime() : 0,
      };
    });

    scored.sort((a, b) => {
      if (b._hasReplies !== a._hasReplies) return b._hasReplies - a._hasReplies;
      if (b._circle !== a._circle) return b._circle - a._circle;
      if (b._likeScore !== a._likeScore) return b._likeScore - a._likeScore;
      if (b._time !== a._time) return b._time - a._time;
      return b.comment.id.localeCompare(a.comment.id);
    });

    // Strip scoring fields — return clean group shape
    return scored.map(({ _hasReplies, _circle, _likeScore, _time, ...group }) => group);
  }, [comments]);

  // Compute "Most Helpful" comment ID (top-level with highest likes >= 2)
  const mostHelpfulCommentId = useMemo(() => {
    if (groupedComments.length === 0) return null;
    let best: { id: string; likes: number } | null = null;
    for (const group of groupedComments) {
      const likes = group.comment.like_count || 0;
      if (likes >= 2 && (!best || likes > best.likes)) {
        best = { id: group.comment.id, likes };
      }
    }
    return best?.id || null;
  }, [groupedComments]);

  // Fetch reputation scores for all unique comment authors
  useEffect(() => {
    if (comments.length === 0) return;
    const userIds = [...new Set(comments.map(c => c.user_id))];
    fetchCommentUserReputations(userIds).then(setTrustedUserIds);
  }, [comments]);

  // Auto-expand threads with highlighted comment or 1-2 replies
  useEffect(() => {
    const newExpanded = new Set<string>();

    groupedComments.forEach(group => {
      // Auto-expand if 1-2 replies
      if (group.replies.length > 0 && group.replies.length <= 2) {
        newExpanded.add(group.comment.id);
      }
      // Auto-expand if highlighted comment is a reply in this thread
      if (highlightCommentId && group.replies.some(r => r.id === highlightCommentId)) {
        newExpanded.add(group.comment.id);
      }
    });

    setExpandedThreads(prev => {
      const merged = new Set([...prev, ...newExpanded]);
      return merged;
    });
  }, [groupedComments, highlightCommentId]);

  const totalCommentCount = comments.length;

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
      const commentData = await fetchComments(itemId, itemType, user?.id);
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

  const handleReplySubmit = async (parentComment: CommentData) => {
    if (!requireAuth({ action: 'comment', surface: 'inline_comment_thread' })) return;
    if (!canPerformAction('canComment')) {
      showVerificationRequired('canComment');
      return;
    }
    if (!replyContent.trim()) return;

    // Determine the actual parent (always top-level)
    const parentId = parentComment.parent_id || parentComment.id;

    setIsSending(true);
    try {
      const success = await addComment(itemId, itemType, replyContent, user.id, parentId);
      if (!success) throw new Error("Failed to add reply");

      setReplyContent('');
      setReplyingTo(null);

      // Auto-expand the thread
      setExpandedThreads(prev => new Set([...prev, parentId]));
      
      loadComments();

      const refreshEventName = `refresh-${itemType}-comment-count`;
      window.dispatchEvent(new CustomEvent(refreshEventName, { detail: { itemId } }));

      try { feedbackActions.comment(); } catch {}

      toast({ title: "Reply added", description: "Your reply has been added successfully" });
    } catch (error) {
      console.error('Error adding reply:', error);
      toast({ title: "Error adding reply", description: "Please try again later", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleReplyClick = useCallback((comment: CommentData) => {
    if (!requireAuth({ action: 'comment', surface: 'inline_comment_thread' })) return;
    
    setReplyingTo(comment);
    setReplyContent('');
    
    // Focus the reply textarea after render
    setTimeout(() => replyTextareaRef.current?.focus(), 100);
  }, [requireAuth]);

  const handleLikeClick = useCallback(async (comment: CommentData) => {
    if (!requireAuth({ action: 'like', surface: 'inline_comment_thread' })) return;
    if (!canPerformAction('canLikeContent')) {
      showVerificationRequired('canLikeContent');
      return;
    }

    // Optimistic update
    const wasLiked = comment.is_liked;
    setComments(prev => prev.map(c => 
      c.id === comment.id 
        ? { ...c, is_liked: !wasLiked, like_count: (c.like_count || 0) + (wasLiked ? -1 : 1) }
        : c
    ));

    try {
      const result = await toggleCommentLike(comment.id, itemType === 'post' ? 'post' : 'recommendation', user.id);
      if (result === null) {
        // Revert on failure
        setComments(prev => prev.map(c => 
          c.id === comment.id 
            ? { ...c, is_liked: wasLiked, like_count: (c.like_count || 0) + (wasLiked ? 1 : -1) }
            : c
        ));
      }
    } catch {
      // Revert
      setComments(prev => prev.map(c => 
        c.id === comment.id 
          ? { ...c, is_liked: wasLiked, like_count: (c.like_count || 0) + (wasLiked ? 1 : -1) }
          : c
      ));
    }
  }, [requireAuth, canPerformAction, showVerificationRequired, user, itemType]);

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

      // Remove from local state (deleted comment + its replies if top-level)
      const deletedComment = comments.find(c => c.id === commentId);
      if (deletedComment && !deletedComment.parent_id) {
        // Top-level: remove it and all its replies
        setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
      } else {
        // Reply: just remove it
        setComments(prev => prev.filter(c => c.id !== commentId));
      }

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

  const toggleThread = (commentId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // Determine @username for reply-to-reply display
  const getReplyToUsername = (reply: CommentData, parentComment: CommentData): string | undefined => {
    // If replying to the top-level comment author, no need to show @username
    // Only show when the reply's content implies replying to someone other than the parent
    return undefined;
  };

  return (
    <div ref={commentSectionRef} className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Comments</h3>
        {!isLoading && <span className="text-xs text-muted-foreground">({totalCommentCount})</span>}
        {!isLoading && groupedComments.length >= 2 && (
          <span className="text-xs text-muted-foreground ml-auto">Sorted by relevance</span>
        )}
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
          <p className="text-sm">No comments yet. Share your experience or ask something!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groupedComments.map((group) => (
            <div key={group.comment.id}>
              {/* Top-level comment */}
              <CommentItem
                comment={group.comment}
                currentUserId={user?.id}
                editingCommentId={editingCommentId}
                editCommentContent={editCommentContent}
                isEditing={isEditing}
                onEditClick={handleEditClick}
                onEditCancel={handleEditCancel}
                onEditSave={handleEditSave}
                onEditContentChange={setEditCommentContent}
                onDeleteClick={handleDeleteClick}
                onReplyClick={handleReplyClick}
                onLikeClick={handleLikeClick}
                highlightCommentId={highlightCommentId}
              />

              {/* Replies */}
              {group.replies.length > 0 && (
                <div className="ml-6 bg-muted/20 rounded-lg p-2">
                  {group.replies.length <= 2 ? (
                    // Auto-expanded
                    group.replies.map(reply => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        isReply
                        currentUserId={user?.id}
                        replyToUsername={getReplyToUsername(reply, group.comment)}
                        editingCommentId={editingCommentId}
                        editCommentContent={editCommentContent}
                        isEditing={isEditing}
                        onEditClick={handleEditClick}
                        onEditCancel={handleEditCancel}
                        onEditSave={handleEditSave}
                        onEditContentChange={setEditCommentContent}
                        onDeleteClick={handleDeleteClick}
                        onReplyClick={handleReplyClick}
                        onLikeClick={handleLikeClick}
                        highlightCommentId={highlightCommentId}
                      />
                    ))
                  ) : (
                    // Collapsible for 3+
                    <Collapsible
                      open={expandedThreads.has(group.comment.id)}
                      onOpenChange={() => toggleThread(group.comment.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="text-xs text-primary hover:text-primary/80 font-medium py-1 px-3 transition-colors">
                          {expandedThreads.has(group.comment.id)
                            ? 'Hide replies'
                            : `View ${group.replies.length} replies`
                          }
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {group.replies.map(reply => (
                          <CommentItem
                            key={reply.id}
                            comment={reply}
                            isReply
                            currentUserId={user?.id}
                            replyToUsername={getReplyToUsername(reply, group.comment)}
                            editingCommentId={editingCommentId}
                            editCommentContent={editCommentContent}
                            isEditing={isEditing}
                            onEditClick={handleEditClick}
                            onEditCancel={handleEditCancel}
                            onEditSave={handleEditSave}
                            onEditContentChange={setEditCommentContent}
                            onDeleteClick={handleDeleteClick}
                            onReplyClick={handleReplyClick}
                            onLikeClick={handleLikeClick}
                            highlightCommentId={highlightCommentId}
                          />
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}

              {/* Inline reply input */}
              {replyingTo && (replyingTo.id === group.comment.id || group.replies.some(r => r.id === replyingTo.id)) && (
                <div className="ml-6 p-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    Replying to <span className="font-medium text-foreground">@{replyingTo.username}</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <Textarea
                      ref={replyTextareaRef}
                      placeholder="Write a reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      disabled={isSending}
                      rows={1}
                      className="min-h-[36px] max-h-[100px] flex-1 resize-none bg-muted/50 border-0 focus:ring-0 focus-visible:ring-0 rounded-xl py-2 px-3 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleReplySubmit(replyingTo);
                        }
                        if (e.key === 'Escape') {
                          setReplyingTo(null);
                          setReplyContent('');
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="icon"
                        className={cn(
                          "rounded-full h-8 w-8 flex-shrink-0 transition-colors",
                          replyContent.trim()
                            ? "bg-foreground text-background hover:bg-foreground/90"
                            : "bg-muted text-muted-foreground"
                        )}
                        onClick={() => handleReplySubmit(replyingTo)}
                        disabled={!replyContent.trim() || isSending}
                      >
                        <ArrowUp size={14} className={isSending ? "animate-pulse" : ""} />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
            placeholder="Share your experience, or ask someone who's tried this"
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
