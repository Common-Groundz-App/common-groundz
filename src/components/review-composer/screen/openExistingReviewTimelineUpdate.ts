/**
 * Step 3B — hands an existing review over to the (still legacy) timeline
 * update experience. Built on the Step 1 pieces: the signed-in
 * `findOwnReviewForEntity` lookup, its stored-slug destination, and the entity
 * page's one-time `openReviewUpdate` state. Never falls back to an ID URL, a
 * name-derived slug, `?compose=update`, or a different review.
 */
import { findOwnReviewForEntity, type OwnReviewLookup } from '@/services/review/ownReview';

export type OpenTimelineResult =
  | { status: 'opened' }
  | { status: 'not_found' }
  | { status: 'mismatch' }
  | { status: 'no_destination' }
  | { status: 'lookup_failed' };

export const isRetryableOpenResult = (r: OpenTimelineResult) =>
  r.status === 'no_destination' || r.status === 'lookup_failed';

type Navigate = (to: string, options: { state: { openReviewUpdate: { reviewId: string } } }) => void;

export async function openExistingReviewTimelineUpdate(
  input: { entityId: string; expectedReviewId: string | null; navigate: Navigate },
  lookup: (entityId: string) => Promise<OwnReviewLookup> = findOwnReviewForEntity,
): Promise<OpenTimelineResult> {
  const found = await lookup(input.entityId);
  if (found.status === 'error') return { status: 'lookup_failed' };
  if (found.status === 'none') return { status: 'not_found' };
  if (input.expectedReviewId && found.review.id !== input.expectedReviewId) return { status: 'mismatch' };
  if (!found.canonicalPath) return { status: 'no_destination' };
  input.navigate(found.canonicalPath, { state: { openReviewUpdate: { reviewId: found.review.id } } });
  return { status: 'opened' };
}
