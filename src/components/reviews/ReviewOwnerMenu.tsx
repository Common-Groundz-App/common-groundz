import React, { useState } from 'react';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReviewEditTooltipContent } from './ReviewEditTooltipContent';
import { DeleteConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { deleteReviewThread } from '@/services/review/core';
import { notifyReviewsChanged } from '@/services/review/reviewChangeEvents';
import {
  canEditReview,
  isWithinEditWindow,
  REVIEW_DELETE_AFTER_HOUR_HINT,
  REVIEW_DELETE_DESCRIPTION,
  REVIEW_DELETE_TITLE,
  REVIEW_MODERATION_DELETE_DESCRIPTION,
  REVIEW_MODERATION_DELETE_TITLE,
} from '@/utils/reviewEditPolicy';
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import type { Review } from '@/services/reviewService';

interface ReviewOwnerMenuProps {
  review: { id: string; user_id: string; created_at: string };
  isAdmin?: boolean;
  /** Opens the timeline (where Add timeline update lives). */
  onAddTimelineUpdate?: () => void;
  /** Custom edit handler; when absent, the menu opens the review form itself. */
  onEdit?: () => void;
  /** Full review used by the built-in edit form. */
  editableReview?: Review;
  onEdited?: () => Promise<void> | void;
  onDeleted?: () => void;
  /** Extra items (e.g. admin moderation), rendered between Edit and Delete. */
  children?: React.ReactNode;
  size?: 'sm' | 'xs';
}

/** Step 2 — the one owner menu used on every review card. */
export const ReviewOwnerMenu: React.FC<ReviewOwnerMenuProps> = ({
  review,
  isAdmin = false,
  onAddTimelineUpdate,
  onEdit,
  editableReview,
  onEdited,
  onDeleted,
  children,
  size = 'sm',
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isOwner = !!user && user.id === review.user_id;
  if (!isOwner && !isAdmin) return null;

  // Step 3.0A (F1): author actions are owner-only. An admin viewing someone
  // else's review gets moderation actions only. Admins keep the one-hour
  // bypass on their own reviews.
  const isModerator = !isOwner && isAdmin;
  const canEdit = canEditReview(review, user?.id, isAdmin);
  const afterHour = !isWithinEditWindow(review.created_at);
  const hasEditAction = isOwner && !!(onEdit || editableReview);

  const editItem = hasEditAction ? (
    <DropdownMenuItem
      onClick={() => (onEdit ? onEdit() : setIsEditing(true))}
      className="flex items-center gap-2"
    >
      <Pencil className="h-4 w-4" /> Edit
    </DropdownMenuItem>
  ) : null;

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteReviewThread(review.id);
    setIsDeleting(false);
    if (result === 'deleted') {
      setConfirmOpen(false);
      toast(isModerator ? { title: 'Review removed' } : { title: 'Review deleted', description: 'Your review and its timeline were removed.' });
      onDeleted?.();
    } else if (result === 'not_found') {
      // Already gone (e.g. deleted in another tab): reconcile, not an error.
      setConfirmOpen(false);
      notifyReviewsChanged();
      toast({ title: 'This review was already deleted' });
      onDeleted?.();
    } else {
      toast({ title: 'Could not delete', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const btn = size === 'xs' ? 'h-6 w-6' : 'h-8 w-8';
  const icon = size === 'xs' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`rounded-full p-0 ${btn}`} onClick={stop} aria-label="Review options">
            <MoreVertical className={icon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          {isOwner && onAddTimelineUpdate && (
            <DropdownMenuItem onClick={onAddTimelineUpdate} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add timeline update
            </DropdownMenuItem>
          )}
          {hasEditAction && (
            isAdmin ? editItem : canEdit ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>{editItem}</TooltipTrigger>
                  <ReviewEditTooltipContent>
                    You can edit for 1 hour after publishing.
                  </ReviewEditTooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuItem
                      onClick={(event) => event.preventDefault()}
                      onSelect={(event) => event.preventDefault()}
                      className="flex items-center gap-2 opacity-50 cursor-not-allowed"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  </TooltipTrigger>
                  <ReviewEditTooltipContent>
                    Edit window closed (1 hour limit)
                  </ReviewEditTooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          )}
          {children}
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" /> {isModerator ? 'Remove review (moderation)' : 'Delete'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title={isModerator ? REVIEW_MODERATION_DELETE_TITLE : REVIEW_DELETE_TITLE}
        description={
          isModerator
            ? REVIEW_MODERATION_DELETE_DESCRIPTION
            : afterHour
              ? `${REVIEW_DELETE_DESCRIPTION} ${REVIEW_DELETE_AFTER_HOUR_HINT}`
              : REVIEW_DELETE_DESCRIPTION
        }
        isLoading={isDeleting}
      />

      {isEditing && editableReview && (
        <ReviewForm
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSubmit={async () => {
            await onEdited?.();
          }}
          review={editableReview}
          isEditMode
        />
      )}
    </>
  );
};

export default ReviewOwnerMenu;
