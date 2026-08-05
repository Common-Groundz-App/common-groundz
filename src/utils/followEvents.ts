/**
 * Single source of truth for the `follow-status-changed` window event.
 *
 * Two surfaces write follow rows (the profile header and the notification
 * drawer) and several read-only surfaces (follower/following counts, viewed
 * profile, drawer rows) react to the event. Routing every dispatch through this
 * helper keeps the payload shape from drifting and keeps one rule in one place:
 *
 *   only a REAL state transition is announced.
 *
 * A duplicate follow (ON CONFLICT DO NOTHING matched an existing row) or a
 * no-op unfollow writes nothing, so it must not dispatch — count listeners treat
 * every event as a +1/-1 and would otherwise double-count.
 */

export const FOLLOW_STATUS_CHANGED_EVENT = 'follow-status-changed';

export type FollowAction = 'follow' | 'unfollow';

export interface FollowStatusChangedDetail {
  /** The user who performed the follow/unfollow. */
  follower: string;
  /** The user who was followed/unfollowed. */
  following: string;
  action: FollowAction;
}

/** Dispatch only when the database write actually changed state. */
export function dispatchFollowStatusChanged(detail: FollowStatusChangedDetail): void {
  if (typeof window === 'undefined') return;
  if (!detail.follower || !detail.following) return;
  window.dispatchEvent(
    new CustomEvent<FollowStatusChangedDetail>(FOLLOW_STATUS_CHANGED_EVENT, { detail }),
  );
}

/**
 * Narrow an incoming event to a well-formed detail, or null.
 * Listeners must never trust the payload shape blindly.
 */
export function parseFollowStatusChanged(event: Event): FollowStatusChangedDetail | null {
  const detail = (event as CustomEvent).detail as Partial<FollowStatusChangedDetail> | undefined;
  if (!detail) return null;
  const { follower, following, action } = detail;
  if (typeof follower !== 'string' || !follower) return null;
  if (typeof following !== 'string' || !following) return null;
  if (action !== 'follow' && action !== 'unfollow') return null;
  return { follower, following, action };
}

/**
 * Account-scoped relevance check: react only when the signed-in user is the one
 * who acted AND the event targets the entity this surface is showing.
 */
export function isFollowEventFor(
  detail: FollowStatusChangedDetail,
  viewerId: string | null | undefined,
  targetId: string | null | undefined,
): boolean {
  if (!viewerId || !targetId) return false;
  return detail.follower === viewerId && detail.following === targetId;
}

/** Postgres unique-violation — a duplicate follow is a success, not an error. */
export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === UNIQUE_VIOLATION;
}
