import React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type ExistingReviewNoticeState = 'checking' | 'found' | 'error';

interface ExistingReviewNoticeProps {
  state: ExistingReviewNoticeState;
  onAddUpdate: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

/**
 * Review Lifecycle Step 1 — shown in the review form when the chosen subject
 * already has (or may have) a review by this person. Creation stays blocked
 * for every state shown here.
 */
const ExistingReviewNotice = ({ state, onAddUpdate, onCancel, onRetry }: ExistingReviewNoticeProps) => {
  if (state === 'checking') {
    return (
      <div className="rounded-lg border border-border p-4 space-y-2" aria-live="polite" aria-busy="true">
        <span className="sr-only">Checking whether you've already reviewed this</span>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <p className="text-sm text-foreground">
          We couldn't check whether you've already reviewed this. Please try again.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
      <div>
        <p className="font-medium text-foreground">You've already reviewed this</p>
        <p className="text-sm text-muted-foreground">
          Add an update to your existing review to share how it's going now.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onAddUpdate}>
          Add an update
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ExistingReviewNotice;
