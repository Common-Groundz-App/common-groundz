/**
 * Single source of truth for post edit policy.
 *
 * Philosophy (see mem://features/posts/edit-vs-update-policy):
 *   • Edits = quick fixes within a short window after posting (typo, mention, tag).
 *   • Updates = append-only entries for evolving experiences (separate, future feature).
 *
 * Time-limited edits prevent silent rewriting of posts that already have engagement,
 * preserving trust and timeline integrity. Admins bypass the window for moderation.
 *
 * The `last_edited_at` column on `posts` is set ONLY when a user edits via the
 * composer — never by background triggers (comment counts, trending, etc.).
 * This avoids false "edited" flags from denormalization jobs.
 */

export const EDIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface EditablePostShape {
  user_id?: string | null;
  created_at?: string | null;
  last_edited_at?: string | null;
}

/**
 * Returns true if the given post can still be edited by the given user.
 * Admin role bypasses both ownership and the time window.
 */
export function canEditPost(
  post: EditablePostShape | null | undefined,
  currentUserId: string | null | undefined,
  isAdmin: boolean = false
): boolean {
  if (!post) return false;
  if (isAdmin) return true;
  if (!currentUserId) return false;
  if (post.user_id !== currentUserId) return false;
  return msSinceCreated(post) < EDIT_WINDOW_MS;
}

/**
 * Returns true when a post has actually been edited via the composer.
 * Uses an explicit marker field (not updated_at math) so background row
 * touches (denormalization, recounts, etc.) never trigger a false "edited"
 * indicator.
 */
export function hasBeenEdited(post: EditablePostShape | null | undefined): boolean {
  return !!post?.last_edited_at;
}

/**
 * Milliseconds remaining in the edit window, or 0 if expired / no created_at.
 * Useful for tooltips like "12 minutes left to edit" if we ever surface it.
 */
export function msRemainingToEdit(post: EditablePostShape | null | undefined): number {
  if (!post?.created_at) return 0;
  const remaining = EDIT_WINDOW_MS - msSinceCreated(post);
  return Math.max(0, remaining);
}

function msSinceCreated(post: EditablePostShape): number {
  if (!post.created_at) return Number.POSITIVE_INFINITY;
  const created = new Date(post.created_at).getTime();
  if (Number.isNaN(created)) return Number.POSITIVE_INFINITY;
  return Date.now() - created;
}
