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

export type ComposerServerResult =
  | { status: 'ok'; id?: string }
  | { status: 'expired' }
  | { status: 'not_latest' }
  | { status: 'unauthorized' }
  | { status: 'existing_review'; reviewId: string | null }
  | { status: 'conflict' }
  | { status: 'not_found' }
  | { status: 'error'; cause?: unknown };

export type BlockedReason =
  | 'expired'
  | 'not_latest'
  | 'unauthorized'
  | 'existing_review'
  | 'not_found'
  | 'subject_not_found';

const TIMELINE_STATUSES = ['ok', 'expired', 'not_latest', 'unauthorized', 'conflict', 'not_found'] as const;
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
  if (isOwnReviewUniqueViolation(error)) return { status: 'existing_review', reviewId: existingReviewId };
  return { status: 'error', cause: error };
}

export function fromUpdateReviewError(error: unknown): ComposerServerResult {
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
