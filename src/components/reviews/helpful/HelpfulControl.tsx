import React from 'react';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewWithUser } from '@/types/entities';
import { useReviewHelpful } from './ReviewHelpfulContext';

interface HelpfulControlProps {
  review: ReviewWithUser;
  isPrivateReview?: boolean;
  className?: string;
}

/** Compact Helpful action for root reviews. Hidden on private reviews. */
export const HelpfulControl: React.FC<HelpfulControlProps> = ({ review, isPrivateReview, className }) => {
  const ctx = useReviewHelpful();
  if (!ctx || isPrivateReview || review.visibility !== 'public') return null;

  const count = review.likes || 0;
  const isAuthor = !!ctx.viewerId && ctx.viewerId === review.user_id;

  if (isAuthor) {
    if (count === 0) return null;
    return (
      <span
        data-testid="helpful-passive"
        className={cn('inline-flex items-center gap-1.5 text-sm text-muted-foreground', className)}
      >
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        <span>Helpful · {count}</span>
      </span>
    );
  }

  const selected = !!ctx.viewerId && !!review.isLiked;
  const pending = ctx.isPending(review.id);
  const label = selected
    ? `Remove Helpful vote (${count} found this helpful)`
    : `Mark as Helpful (${count} found this helpful)`;

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        ctx.toggle(review);
      }}
      className={cn(
        '-my-2 -ml-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-2 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        selected ? 'font-medium text-primary' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      <ThumbsUp className={cn('h-4 w-4', selected && 'fill-current')} aria-hidden="true" />
      <span>Helpful{count > 0 ? ` · ${count}` : ''}</span>
    </button>
  );
};
