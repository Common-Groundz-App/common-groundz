
import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, Heart, MessageCircle, Users, ThumbsUp, ShieldCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import UsernameLink from '@/components/common/UsernameLink';
import { getInitialsFromName } from '@/utils/profileUtils';
import { formatDistanceToNow } from 'date-fns';
import { CommentData } from '@/services/commentsService';

interface CommentItemProps {
  comment: CommentData;
  isReply?: boolean;
  isDeleted?: boolean;
  currentUserId?: string | null;
  replyToUsername?: string;
  editingCommentId: string | null;
  editCommentContent: string;
  isEditing: boolean;
  onEditClick: (comment: CommentData) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onEditContentChange: (content: string) => void;
  onDeleteClick: (commentId: string) => void;
  onReplyClick: (comment: CommentData) => void;
  onLikeClick: (comment: CommentData) => void;
  highlightCommentId?: string | null;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  isReply = false,
  isDeleted = false,
  currentUserId,
  replyToUsername,
  editingCommentId,
  editCommentContent,
  isEditing,
  onEditClick,
  onEditCancel,
  onEditSave,
  onEditContentChange,
  onDeleteClick,
  onReplyClick,
  onLikeClick,
  highlightCommentId,
}) => {
  const isCurrentUser = currentUserId && currentUserId === comment.user_id;
  const isBeingEdited = editingCommentId === comment.id;
  const isHighlighted = highlightCommentId === comment.id;

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: false });
    } catch { return ''; }
  };

  const isEdited = comment.edited_at && comment.edited_at !== comment.created_at;

  if (isDeleted) {
    return (
      <div
        id={`comment-${comment.id}`}
        className={cn("flex gap-3 p-3 rounded-lg", isReply && "pl-10")}
      >
        <div className="flex-1">
          <p className="text-sm text-muted-foreground italic">[Comment deleted]</p>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn(
        "relative group flex gap-3 p-3 rounded-lg transition-colors",
        isBeingEdited && "bg-muted/50",
        isReply && cn("pl-10 border-l-2", comment.is_from_circle ? "border-primary/40" : "border-muted"),
        isHighlighted && "bg-accent/50"
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
                {isEdited && (
                  <>
                    <span>·</span>
                    <span className="italic">Edited</span>
                  </>
                )}
              </div>
              {comment.is_from_circle && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users size={12} />
                  <span>From your circle</span>
                </div>
              )}
            </div>

            {isBeingEdited ? (
              <div className="mt-1">
                <Textarea
                  value={editCommentContent}
                  onChange={(e) => onEditContentChange(e.target.value)}
                  className="min-h-[60px] text-sm resize-none bg-muted/30 border focus:border-primary focus:ring-0 focus-visible:ring-0"
                  placeholder="Edit your comment..."
                  disabled={isEditing}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="ghost" size="sm" onClick={onEditCancel} disabled={isEditing}>
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={onEditSave} disabled={isEditing || !editCommentContent.trim()}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm break-words">
                {replyToUsername && (
                  <span className="text-primary font-medium mr-1">@{replyToUsername}</span>
                )}
                {comment.content}
              </p>
            )}

            {/* Action row */}
            {!isBeingEdited && (
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={() => onLikeClick(comment)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Heart
                    size={14}
                    className={cn(
                      "transition-colors",
                      comment.is_liked && "fill-destructive text-destructive"
                    )}
                  />
                  {(comment.like_count || 0) > 0 && (
                    <span>{comment.like_count}</span>
                  )}
                </button>
                {!isReply && (
                  <button
                    onClick={() => onReplyClick(comment)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageCircle size={14} />
                    {(comment.reply_count || 0) > 0 && (
                      <span>{comment.reply_count}</span>
                    )}
                    <span>Reply</span>
                  </button>
                )}
                {isReply && (
                  <button
                    onClick={() => onReplyClick(comment)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageCircle size={14} />
                    <span>Reply</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {isCurrentUser && !isBeingEdited && (
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
                <DropdownMenuItem onClick={() => onEditClick(comment)}>Edit</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDeleteClick(comment.id)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
