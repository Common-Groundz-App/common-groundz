/**
 * Review lifecycle Step 2 — one-hour Edit window for reviews and timeline updates.
 *
 * Same window as posts (EDIT_WINDOW_MS). The hour is counted from when the
 * review / timeline update was first posted (`created_at`); editing never
 * restarts it. The database is authoritative; this only shows/hides Edit.
 */
import { EDIT_WINDOW_MS } from './postEditPolicy';

export interface TimedOwnedShape {
  user_id?: string | null;
  created_at?: string | null;
}

export function isWithinEditWindow(createdAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return now - created < EDIT_WINDOW_MS;
}

/** Owner within the hour; admins bypass the window (server-checked). */
export function canEditReview(
  review: TimedOwnedShape | null | undefined,
  currentUserId: string | null | undefined,
  isAdmin = false,
  now: number = Date.now(),
): boolean {
  if (!review) return false;
  if (isAdmin) return true;
  if (!currentUserId || review.user_id !== currentUserId) return false;
  return isWithinEditWindow(review.created_at, now);
}

/** Owner only, latest update only, within that update's hour. */
export function canEditTimelineUpdate(
  update: TimedOwnedShape | null | undefined,
  currentUserId: string | null | undefined,
  isLatest: boolean,
  now: number = Date.now(),
): boolean {
  if (!update || !isLatest) return false;
  if (!currentUserId || update.user_id !== currentUserId) return false;
  return isWithinEditWindow(update.created_at, now);
}

export const REVIEW_DELETE_TITLE = 'Delete your review and its complete timeline?';
export const REVIEW_DELETE_DESCRIPTION =
  'This permanently removes the original review and all timeline updates.';
export const REVIEW_DELETE_AFTER_HOUR_HINT =
  'If your experience changed, consider adding a timeline update instead.';
export const UPDATE_DELETE_TITLE = 'Delete this timeline update?';
export const UPDATE_DELETE_DESCRIPTION = 'Your original review and earlier updates will remain.';

/** True when a save failed because the database closed the edit window. */
export function isEditWindowClosedError(error: unknown): boolean {
  const msg = (error as { message?: string } | null)?.message ?? '';
  return msg.includes('review_edit_window_closed');
}
