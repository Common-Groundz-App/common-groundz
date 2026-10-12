/**
 * Typed server results the composer consumes.
 *
 * The composer never inspects error text. Adapters here only translate results
 * that the service layer has already normalized:
 *  - timeline RPCs return typed statuses;
 *  - a duplicate review is recognised by `isOwnReviewUniqueViolation`
 *    (SQLSTATE 23505 + the one-review-per-subject constraint);
 *  - review Edit's closed window is recognised by the one existing helper
 *    `isEditWindowClosedError`, until the server exposes a typed result.
 * Anything unrecognised stays a genuine error.
 */
import { isOwnReviewUniqueViolation } from '@/services/review/ownReview';
import { isEditWindowClosedError } from '@/utils/reviewEditPolicy';
import { isMediaRetiredError } from '@/utils/mediaRetired';

export type ComposerServerResult =
  | { status: 'ok'; id?: string }
  | { status: 'expired' }
  | { status: 'not_latest' }
  | { status: 'unauthorized' }
  | { status: 'existing_review'; reviewId: string | null }
  | { status: 'conflict' }
  | { status: 'not_found' }
  | { status: 'media_retired' }
  | { status: 'error'; cause?: unknown };

export type BlockedReason =
  | 'expired'
  | 'not_latest'
  | 'unauthorized'
  | 'existing_review'
  | 'not_found'
  | 'subject_not_found';

const TIMELINE_STATUSES = ['ok', 'expired', 'not_latest', 'unauthorized', 'conflict', 'not_found', 'media_retired'] as const;

export const MEDIA_RETIRED_TOAST = {
  title: 'A photo was already removed',
  description: 'One of these photos was removed earlier. Remove it and add it again, then save.',
  variant: 'destructive' as const,
};
type TimelineStatus = (typeof TIMELINE_STATUSES)[number];

/** Timeline edit / undo RPC statuses (already typed by the service). */
export function fromTimelineStatus(status: string | null | undefined): ComposerServerResult {
  if (status && (TIMELINE_STATUSES as readonly string[]).includes(status)) {
    return { status: status as TimelineStatus } as ComposerServerResult;
  }
  return { status: 'error', cause: status };
}

/** Timeline create service returns a boolean today. */
export function fromTimelineCreate(ok: boolean): ComposerServerResult {
  return ok ? { status: 'ok' } : { status: 'error' };
}

export function fromCreateReviewError(error: unknown, existingReviewId: string | null = null): ComposerServerResult {
  if (isMediaRetiredError(error)) return { status: 'media_retired' };
  if (isOwnReviewUniqueViolation(error)) return { status: 'existing_review', reviewId: existingReviewId };
  return { status: 'error', cause: error };
}

export function fromUpdateReviewError(error: unknown): ComposerServerResult {
  if (isMediaRetiredError(error)) return { status: 'media_retired' };
  if (isEditWindowClosedError(error)) return { status: 'expired' };
  return { status: 'error', cause: error };
}

/** Results that block the composer (as opposed to a retryable error). */
export function toBlockedReason(result: ComposerServerResult): BlockedReason | null {
  switch (result.status) {
    case 'expired':
    case 'not_latest':
    case 'unauthorized':
    case 'existing_review':
    case 'not_found':
      return result.status;
    default:
      return null;
  }
}

/* ---------------- review video (Phase 2) ---------------- */

const REVIEW_VIDEO_MESSAGES: Record<string, string> = {
  review_video_public_only: 'Videos are available on public reviews only.',
  review_video_visibility_locked: 'This review has a video, so it must stay public.',
  review_media_too_many: 'You can add up to 4 photos or videos.',
  review_media_one_video: 'You can add only one video.',
  review_video_not_owned: "This video can't be used here. Remove it and add it again.",
  review_video_invalid: "This video can't be used here. Remove it and add it again.",
  review_video_in_use: 'This video is already used somewhere else. Remove it and add it again.',
  review_edit_window_closed: 'Edit window closed (1 hour limit).',
};

/** Friendly message for a Phase 1 review-video refusal, or null. */
export function reviewVideoErrorMessage(error: unknown): string | null {
  const msg = (error as { message?: unknown } | null)?.message;
  if (typeof msg !== 'string') return null;
  for (const code of Object.keys(REVIEW_VIDEO_MESSAGES)) {
    if (msg.includes(code)) return REVIEW_VIDEO_MESSAGES[code];
  }
  return null;
}
