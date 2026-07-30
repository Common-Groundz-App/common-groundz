/**
 * Pure, synchronous resolution of "where does this notification go when tapped?".
 *
 * Deliberately free of `window`, React and network access so it can be unit
 * tested in Node/jsdom and reused anywhere. All URL parsing happens against a
 * fixed placeholder origin that is never emitted.
 */

import type { Notification } from '@/services/notificationService';
import { buildContentPath, isRoutableContentType } from '@/utils/contentRoutes';

/** Never emitted — only used so `new URL()` has something to resolve against. */
const PARSE_ORIGIN = 'http://internal.invalid';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USERNAME_RE = /^[a-zA-Z0-9._-]{1,30}$/;

const UNSAFE_CHARS_RE = /[\u0000-\u001f\u007f\\]/;

export type NotificationDestination =
  | { kind: 'route'; path: string }
  | {
      kind: 'none';
      reason: 'missing-target' | 'unsupported-type' | 'unsafe-url';
    };


/** RFC-shaped, version-agnostic (matches the app's own `generateUUID()`). */
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const asUuid = (value: unknown): string | null =>
  isUuid(value) ? value : null;

/**
 * Validates a pathname against the real route table in `App.tsx`, including
 * the shape of its dynamic segment. Returns the (possibly rewritten) pathname
 * or `null` when the path is not an allowlisted app route.
 */
const matchAllowlistedPath = (pathname: string): string | null => {
  if (pathname === '/my-stuff') return pathname;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2) return null;

  const [head, param] = segments;

  switch (head) {
    case 'post':
    case 'recommendations':
    case 'profile':
      return isUuid(param) ? `/${head}/${param}` : null;
    case 'u':
      return USERNAME_RE.test(param) ? `/u/${param}` : null;
    default:
      return null;
  }
};

/**
 * Accepts ONLY explicit root-relative internal paths (exactly one leading `/`).
 * Rejects absolute URLs, protocol-relative URLs, `javascript:`, backslashes,
 * control characters, relative climbs like `../post/x`, unknown routes and
 * malformed ids. Preserves only the approved query params.
 */
export const normalizeInternalPath = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;

  const value = raw.trim();
  if (!value) return null;

  // Must be explicitly root-relative: one leading slash, and only one.
  if (value[0] !== '/' || value[1] === '/') return null;
  if (UNSAFE_CHARS_RE.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, PARSE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PARSE_ORIGIN) return null;

  // Legacy singular recommendation links point at a route that does not exist.
  let pathname = url.pathname.replace(
    /^\/recommendation\//,
    '/recommendations/'
  );

  const allowed = matchAllowlistedPath(pathname);
  if (!allowed) return null;
  pathname = allowed;

  // Structural rebuild — foreign params dropped, join can never be malformed.
  const params = new URLSearchParams();
  const commentId = url.searchParams.get('commentId');
  if (isUuid(commentId)) params.set('commentId', commentId);
  if (url.searchParams.get('focus') === 'comment') params.set('focus', 'comment');

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
};

export type NotificationDestinationInput = Pick<
  Notification,
  'type' | 'entity_type' | 'entity_id' | 'action_url' | 'sender_id'
> & { metadata?: Record<string, any> | null };


/**
 * Structured entity fields take precedence over the stored `action_url`, which
 * is only used as a last-resort fallback for shapes we don't model.
 */
export const resolveNotificationDestination = (
  notification: NotificationDestinationInput
): NotificationDestination => {
  const entityType = notification.entity_type ?? null;
  const entityId = asUuid(notification.entity_id);
  const commentId = asUuid(notification.metadata?.comment_id);

  // 1. Post / recommendation → full content page, with exact comment when known.
  if (isRoutableContentType(entityType)) {
    const path = buildContentPath(entityType, entityId, commentId);
    if (path) {
      return { kind: 'route', path };
    }
  }


  // 2. Follows and profile notifications → the actor's profile.
  if (entityType === 'profile' || notification.type === 'follow') {
    const profileId = entityId ?? asUuid(notification.sender_id);
    if (profileId) {
      return { kind: 'route', path: `/profile/${profileId}` };
    }
  }

  // 3. Journey notifications (defensive — not currently emitted).
  if (entityType === 'journey') {
    return { kind: 'route', path: '/my-stuff' };
  }

  // 4. Reviews have no viewer surface; fall through to the safe URL fallback.

  // 5. Fallback: sanitized action_url.
  if (notification.action_url) {
    const path = normalizeInternalPath(notification.action_url);
    if (path) return { kind: 'route', path };
    return { kind: 'none', reason: 'unsafe-url' };
  }

  // 6. Nothing usable.
  if (entityType === 'review') {
    return { kind: 'none', reason: 'unsupported-type' };
  }
  return { kind: 'none', reason: 'missing-target' };
};

export const destinationUnavailableMessage = (
  reason: Extract<NotificationDestination, { kind: 'none' }>['reason']
): string => {
  switch (reason) {
    case 'unsafe-url':
      return "This notification's link couldn't be opened safely";
    case 'unsupported-type':
      return "This notification doesn't have a page to open yet";
    default:
      return "This notification doesn't have any associated content";
  }
};
