
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

// ---------------------------------------------------------------------------
// Cursor ordering — the single ordering authority
// ---------------------------------------------------------------------------
//
// Raw ISO strings CANNOT be compared lexicographically: `.123Z`,
// `.123000+00:00` and `2026-07-29T15:30:00.123000+05:30` all describe the same
// instant but sort by their formatting, not their time. So every comparison
// goes through a NORMALIZED key: UTC, fixed width, 9 fractional digits, built
// with integer arithmetic so PostgreSQL's microseconds survive (JS `Date`
// truncates to milliseconds).
//
// The key is for LOCAL comparison only. Cursors sent to PostgREST always carry
// the exact original string, byte for byte.

/** Days since 1970-01-01 from a proleptic Gregorian date (Howard Hinnant). */
const daysFromCivil = (y: number, m: number, d: number): number => {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
};

/** Inverse of `daysFromCivil`. */
const civilFromDays = (z: number): [number, number, number] => {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [y + (m <= 2 ? 1 : 0), m, d];
};

const pad = (n: number, width: number) => String(n).padStart(width, '0');

const cursorKeyCache = new Map<string, string | null>();
const CURSOR_KEY_CACHE_LIMIT = 2000;

/**
 * Normalized, fixed-width UTC comparison key: `YYYYMMDDhhmmssfffffffff`.
 * Returns `null` for anything unparseable — NEVER throws, because this runs
 * inside sort callbacks and React state updaters where an exception would
 * escape the lane's try/catch and take out the drawer.
 */
export const tryCursorKey = (createdAt: unknown): string | null => {
  if (typeof createdAt !== 'string') return null;

  const cached = cursorKeyCache.get(createdAt);
  if (cached !== undefined) return cached;

  let key: string | null = null;
  const match = TIMESTAMP_RE.exec(createdAt);

  if (match) {
    const [, y, mo, d, h, mi, s, frac, offset] = match;
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    const hour = Number(h);
    const minute = Number(mi);
    const second = Number(s);

    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

    const calendarOk =
      month >= 1 && month <= 12 &&
      day >= 1 && day <= daysInMonth &&
      hour <= 23 && minute <= 59 && second <= 60;

    if (calendarOk) {
      let offsetMinutes = 0;
      if (offset !== 'Z') {
        const sign = offset[0] === '-' ? -1 : 1;
        const digits = offset.slice(1).replace(':', '');
        offsetMinutes = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
      }

      // Shift to UTC with integer arithmetic — no Date, no precision loss.
      let totalSeconds =
        daysFromCivil(year, month, day) * 86400 +
        hour * 3600 + minute * 60 + second -
        offsetMinutes * 60;

      const dayIndex = Math.floor(totalSeconds / 86400);
      let rem = totalSeconds - dayIndex * 86400;
      const [uy, um, ud] = civilFromDays(dayIndex);
      const uh = Math.floor(rem / 3600);
      rem -= uh * 3600;
      const umin = Math.floor(rem / 60);
      const usec = rem - umin * 60;

      const fraction = (frac ?? '').padEnd(9, '0');
      key = `${pad(uy, 4)}${pad(um, 2)}${pad(ud, 2)}${pad(uh, 2)}${pad(umin, 2)}${pad(usec, 2)}${fraction}`;
    }
  }

  if (cursorKeyCache.size >= CURSOR_KEY_CACHE_LIMIT) cursorKeyCache.clear();
  cursorKeyCache.set(createdAt, key);
  return key;
};

/** Service-boundary form. Only ever called where a rejection can be caught and
 *  turned into a normal lane error BEFORE any state is committed. */
export const cursorKeyOrThrow = (createdAt: unknown): string => {
  const key = tryCursorKey(createdAt);
  if (key === null) throw new Error(`Unparseable notification timestamp: ${String(createdAt)}`);
  return key;
};

/**
 * DIRECTION IS EXPLICIT — returns a NEGATIVE number when `a` is NEWER, i.e. it
 * sorts first in the `created_at DESC` display order. Never reason about this
 * sign inline; use `isNewerOrEqual` / `isOlderThan` instead.
 *
 * Unkeyable input sorts last rather than throwing (see `tryCursorKey`).
 */
export const compareCursorKeys = (a: string | null, b: string | null): number => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a > b ? -1 : 1;
};

/** `key` is at or newer than `boundary` — i.e. inside a head window ending at
 *  `boundary`. A null boundary means "no window exists". */
export const isNewerOrEqual = (key: string | null, boundary: string | null): boolean =>
  boundary !== null && compareCursorKeys(key, boundary) <= 0;

/** `key` is strictly older than `boundary` (falls outside the head window). */
export const isOlderThan = (key: string | null, boundary: string | null): boolean =>
  boundary !== null && compareCursorKeys(key, boundary) > 0;

/** Comparison key for a loaded row. */
export const rowCursorKey = (row: Pick<Notification, 'created_at'>): string | null =>
  tryCursorKey(row.created_at);

/** Canonical display order: `created_at DESC, id DESC`. Total — never throws. */
export const compareNotifications = (a: Notification, b: Notification): number => {
  const byTime = compareCursorKeys(rowCursorKey(a), rowCursorKey(b));
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
};

/**
 * Fetch-boundary validation. A malformed `created_at` must fail the REQUEST —
 * surfacing as an ordinary, recoverable lane error — rather than reaching state
 * and throwing later from inside a render or a functional setState.
 */
const assertSortableRows = (rows: Notification[]): Notification[] => {
  rows.forEach((row) => cursorKeyOrThrow(row.created_at));
  return rows;
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
 *
 * `unreadOnly` produces the Unread lane's dataset. Note this is a FILTERED
 * dataset, not a view of the All lane: rows leave it once they are read, which
 * is why the Unread lane reconciles differently (see useNotificationLane).
 */
export const fetchNotifications = async (
  options: { limit?: number; cursor?: NotificationCursor | null; unreadOnly?: boolean } = {}
): Promise<NotificationPage> => {
  const { limit = 20, cursor = null, unreadOnly = false } = options;

  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // Over-fetch by one to detect a further page without a second round trip.
    .limit(limit + 1);

  // Applied BEFORE the keyset predicate so the two compose as AND.
  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

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
  // Throws here, at the fetch boundary, if any row is unsortable — the caller
  // turns that into a lane error and commits nothing.
  assertSortableRows(rows);
  const last = rows.length > 0 ? rows[rows.length - 1] : null;

  return {
    rows,
    hasMore: raw.length > limit,
    nextCursor: last ? { created_at: last.created_at, id: last.id } : null,
  };
};

const MEMBERSHIP_CHUNK_SIZE = 200;

/**
 * Which of `ids` are STILL unread on the server.
 *
 * Exists because the Unread lane's older pages can go stale invisibly: a row on
 * page 2 read from another device never appears in a head refresh, so without
 * this it would linger forever.
 *
 * Contract:
 *  - `userId` is REQUIRED and passed in by the caller, which holds it already
 *    and ties it to an auth generation. The service never calls `getUser()` —
 *    that would be redundant auth work per chunk and would decouple the query
 *    from the caller's generation token. RLS remains the authorization
 *    boundary; this predicate exists for index selection.
 *  - empty `ids` performs ZERO queries.
 *  - ALL-OR-NOTHING: one failed chunk rejects the whole call. A partial result
 *    would be indistinguishable from "these ids are read" and would delete live
 *    rows.
 */
export const fetchUnreadMembership = async (
  ids: string[],
  userId: string
): Promise<Set<string>> => {
  if (!ids.length) return new Set();
  if (!userId) {
    throw new Error('fetchUnreadMembership requires an explicit userId');
  }

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MEMBERSHIP_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + MEMBERSHIP_CHUNK_SIZE));
  }

  // Promise.all rejects on the first failure, so nothing partial is returned.
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('is_read', false)
        .in('id', chunk);
      if (error) throw error;
      return (data ?? []) as { id: string }[];
    })
  );

  const stillUnread = new Set<string>();
  results.forEach((rows) => rows.forEach((row) => stillUnread.add(row.id)));
  return stillUnread;
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
 *  - de-duped by id, then sorted through `compareNotifications` — the single
 *    ordering authority. Raw string comparison is NOT used: it would order by
 *    timestamp formatting rather than by time.
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

  // Total comparator — safe inside a functional setState.
  return Array.from(byId.values()).sort(compareNotifications);

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
