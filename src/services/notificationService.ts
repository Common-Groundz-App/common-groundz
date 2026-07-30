
import { supabase } from '@/integrations/supabase/client';

export type NotificationType = 'like' | 'comment' | 'follow' | 'system' | 'journey_watched' | 'journey_digest';
export type EntityType = 'post' | 'recommendation' | 'review' | 'profile' | 'system' | 'journey';

/** Status of the global unread count, tracked separately from list loading so a
 *  count failure never renders list-level error UI. */
export type CountStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Pagination-specific failure. Never conflated with the fetch error channel.
 *  Declared here (not in the hook) so presentational components can type against
 *  it without importing the provider-only hook module. */
export type PageError = 'invalid-cursor' | 'network' | null;

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  sender_id?: string;
  title: string;
  message: string;
  entity_type?: EntityType;
  entity_id?: string;
  is_read: boolean;
  image_url?: string | null;
  action_url?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: {
    comment_id?: string;
    from_entity_id?: string;
    to_entity_id?: string;
    transition_type?: string;
    [key: string]: any;
  };
}

/**
 * Keyset pagination cursor. `created_at` MUST be stored as the exact string
 * Supabase returned — see `isValidCursor` for why.
 */
export interface NotificationCursor {
  created_at: string;
  id: string;
}

/** Thrown when a cursor fails shape validation. Callers surface this as a
 *  pagination-specific error rather than silently refetching page 1. */
export class InvalidCursorError extends Error {
  constructor(message = 'Invalid notification cursor') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 0-9 fractional digits, and either `Z` or a +/-HH:MM offset. Supabase returns
// microsecond precision (6 digits), which JS `Date` cannot represent.
const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})$/;


/**
 * Shape-only cursor validation. Deliberately NON-MUTATING.
 *
 * We never canonicalize `created_at` through `new Date(x).toISOString()`:
 * PostgreSQL `timestamptz` carries microseconds while JS `Date` truncates to
 * milliseconds, so `...T10:00:00.123456Z` would become `...T10:00:00.123Z` and
 * move the pagination boundary — duplicating or skipping every row sharing that
 * millisecond. `Date.parse` is also unusable as a validator because JS engines
 * normalize impossible dates (e.g. Feb 30) instead of rejecting them, so the
 * calendar check below is done on the raw components.
 */
export const isValidCursor = (cursor: unknown): cursor is NotificationCursor => {
  if (!cursor || typeof cursor !== 'object') return false;
  const { created_at, id } = cursor as Partial<NotificationCursor>;

  if (typeof id !== 'string' || !UUID_RE.test(id)) return false;
  if (typeof created_at !== 'string') return false;

  const match = TIMESTAMP_RE.exec(created_at);
  if (!match) return false;

  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 60) return false;

  // Real calendar length for this month/year, computed without Date parsing.
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return false;

  return true;
};

export interface NotificationPage {
  rows: Notification[];
  hasMore: boolean;
  nextCursor: NotificationCursor | null;
}

/**
 * Fetches one page of notifications, newest first.
 *
 * Ordering is `(created_at DESC, id DESC)` and the keyset predicate matches it
 * exactly. The predicate is a SINGLE `.or()` — two chained `.lt()` filters would
 * be AND-ed together and silently drop rows that tie on `created_at`.
 */
export const fetchNotifications = async (
  options: { limit?: number; cursor?: NotificationCursor | null } = {}
): Promise<NotificationPage> => {
  const { limit = 20, cursor = null } = options;

  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // Over-fetch by one to detect a further page without a second round trip.
    .limit(limit + 1);

  if (cursor) {
    if (!isValidCursor(cursor)) throw new InvalidCursorError();
    // Values are double-quoted: timestamps contain `+` and `:` which PostgREST
    // would otherwise treat as syntax. The string is passed through untouched.
    query = query.or(
      `created_at.lt."${cursor.created_at}",and(created_at.eq."${cursor.created_at}",id.lt."${cursor.id}")`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const raw = (data ?? []) as Notification[];
  const rows = raw.slice(0, limit);
  const last = rows.length > 0 ? rows[rows.length - 1] : null;

  return {
    rows,
    hasMore: raw.length > limit,
    nextCursor: last ? { created_at: last.created_at, id: last.id } : null,
  };
};

/** Global unread total for the signed-in user. The RPC returns `bigint`, which
 *  arrives as a string or number depending on size — always normalise it. */
export const fetchUnreadCount = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('get_unread_notification_count');
  if (error) throw error;
  return Number(data ?? 0);
};

/** Server-side mark-all. Returns how many rows were flipped. */
export const markAllNotificationsAsRead = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('mark_all_notifications_as_read');
  if (error) throw error;
  return Number(data ?? 0);
};

export const markNotificationsAsRead = async (notificationIds: string[]): Promise<string[]> => {
  const { data, error } = await supabase
    .rpc('mark_notifications_as_read', { notification_ids: notificationIds });

  if (error) throw error;
  return data || [];
};

/**
 * Single merge helper shared by head refreshes and page appends.
 *
 * Rules:
 *  - incoming (server) data wins per-id for server-owned fields
 *  - `is_read: true` is MONOTONIC — no merge ever returns a row to unread. Valid
 *    only because the app has no mark-as-unread action; if that ever ships,
 *    replace this with row versioning.
 *  - rows only present in older loaded pages are preserved
 *  - de-duped by id, then sorted `created_at DESC, id DESC` (the id tiebreak
 *    matters — timestamps collide)
 */
export const mergeNotifications = (
  accumulated: Notification[],
  incoming: Notification[]
): Notification[] => {
  const byId = new Map<string, Notification>();

  accumulated.forEach((row) => byId.set(row.id, row));

  incoming.forEach((row) => {
    const existing = byId.get(row.id);
    byId.set(row.id, existing ? { ...existing, ...row, is_read: existing.is_read || row.is_read } : row);
  });

  return Array.from(byId.values()).sort((a, b) => {
    if (a.created_at === b.created_at) return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    return a.created_at < b.created_at ? 1 : -1;
  });
};


// Helper function to generate content URLs
export const getContentUrl = (type: EntityType, id: string, commentId?: string): string => {
  if (!type || !id) return '#';
  
  let url = '';
  
  switch (type) {
    case 'post':
      url = `/post/${id}`;
      break;
    case 'recommendation':
      url = `/recommendation/${id}`;
      break;
    case 'review':
      url = `/review/${id}`;
      break;
    case 'profile':
      url = `/profile/${id}`;
      break;
    case 'journey':
      url = `/my-stuff`;
      break;
    default:
      url = '#';
  }
  
  // Add comment ID as a query parameter if provided
  if (commentId) {
    url += `?commentId=${commentId}`;
  }
  
  return url;
};

// Helper to check if notification is a journey type
export const isJourneyNotification = (type: NotificationType): boolean => {
  return type === 'journey_watched' || type === 'journey_digest';
};
