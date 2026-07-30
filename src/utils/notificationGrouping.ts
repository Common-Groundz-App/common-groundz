/**
 * Phase 2.3 — render-time notification aggregation.
 *
 * PURE and PAGE-SCOPED by design: this transform runs over whatever flat rows a
 * lane has currently loaded and returns a display-only structure. It never
 * mutates state, never fetches, and knows nothing about cursors, unread counts,
 * sticky reads or mutation gates.
 *
 * INVARIANT (do not "optimise" away): every count that the hook, the badge, the
 * mismatch banner and pagination rely on is an EVENT count over flat server
 * rows. Group counts are presentation only and must never be substituted for
 * `unreadCount`, `loadedUnreadCount` or `hasMore`.
 *
 * v1 groups top-level post/recommendation LIKES only. Comments, mentions,
 * replies, comment likes, follows and system rows always render as singletons,
 * because each of those has (or will have) a distinct per-comment destination.
 */

import type { Notification } from '@/services/notificationService';

/** Elapsed-time bound, measured from the group's NEWEST child (no transitive
 *  chaining across days via 24h-apart neighbours). */
export const GROUP_WINDOW_MS = 24 * 60 * 60 * 1000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GROUPABLE_ENTITY_TYPES = new Set(['post', 'recommendation']);

export interface NotificationGroup {
  /** Unique per rendered instance — safe as a React key even when the same
   *  base key appears twice in one page (Like A / Follow / Like A). */
  key: string;
  /** The newest child; supplies avatar, timestamp, copy base and destination. */
  representative: Notification;
  /** Every underlying row, newest-first. Length is the EVENT count. */
  notifications: Notification[];
  /** Every underlying notification id — what read mutations operate on. */
  eventIds: string[];
  /** Ids of the unread children only. */
  unreadEventIds: string[];
  /** Distinct sender ids, newest-first. Drives the "and N others" number. */
  actorIds: string[];
  /** True when ANY child is unread. */
  isUnread: boolean;
  /** True only for multi-event groups — single rows render exactly as before. */
  isAggregated: boolean;
}

/** A row may participate in aggregation only if all of these hold. */
export const isGroupableNotification = (n: Notification): boolean =>
  n.type === 'like' &&
  typeof n.entity_type === 'string' &&
  GROUPABLE_ENTITY_TYPES.has(n.entity_type) &&
  typeof n.entity_id === 'string' &&
  UUID_RE.test(n.entity_id) &&
  !n.metadata?.comment_id;

/** Shared target identity. Not unique on its own — see `NotificationGroup.key`. */
const baseKey = (n: Notification) => `${n.type}|${n.entity_type}|${n.entity_id}`;

const timeOf = (n: Notification): number | null => {
  const t = Date.parse(n.created_at);
  return Number.isFinite(t) ? t : null;
};

const finalize = (rows: Notification[]): NotificationGroup => {
  const representative = rows[0];
  const actorIds: string[] = [];
  for (const row of rows) {
    if (row.sender_id && !actorIds.includes(row.sender_id)) actorIds.push(row.sender_id);
  }
  return {
    key: `${baseKey(representative)}|${representative.id}`,
    representative,
    notifications: rows,
    eventIds: rows.map((r) => r.id),
    unreadEventIds: rows.filter((r) => !r.is_read).map((r) => r.id),
    actorIds,
    isUnread: rows.some((r) => !r.is_read),
    isAggregated: rows.length > 1,
  };
};

const singleton = (n: Notification): NotificationGroup => ({
  key: n.id,
  representative: n,
  notifications: [n],
  eventIds: [n.id],
  unreadEventIds: n.is_read ? [] : [n.id],
  actorIds: n.sender_id ? [n.sender_id] : [],
  isUnread: !n.is_read,
  isAggregated: false,
});

/**
 * Collapses ADJACENT, time-bounded, same-target likes into groups. Order is
 * preserved exactly: a non-matching row between two likes breaks the run, so
 * the feed is never reordered.
 */
export const groupNotifications = (
  notifications: Notification[]
): NotificationGroup[] => {
  const out: NotificationGroup[] = [];
  let run: Notification[] = [];
  let runKey: string | null = null;
  let runNewest: number | null = null;

  const flush = () => {
    if (run.length === 1) out.push(singleton(run[0]));
    else if (run.length > 1) out.push(finalize(run));
    run = [];
    runKey = null;
    runNewest = null;
  };

  for (const n of notifications) {
    if (!isGroupableNotification(n)) {
      flush();
      out.push(singleton(n));
      continue;
    }

    const key = baseKey(n);
    const t = timeOf(n);

    // Unparseable timestamps can't be window-checked — never aggregate them.
    if (t === null) {
      flush();
      out.push(singleton(n));
      continue;
    }

    const withinWindow = runNewest !== null && runNewest - t <= GROUP_WINDOW_MS;
    if (runKey === key && withinWindow) {
      run.push(n);
      continue;
    }

    flush();
    run = [n];
    runKey = key;
    runNewest = t; // anchored on the newest child, never advanced downward
  }

  flush();
  return out;
};

/**
 * Group copy WITHOUT identity parsing and WITHOUT profile lookups.
 *
 * The helper is pure and only has sender ids, so it never claims display names.
 * It reuses the representative's own title verbatim and appends a distinct-actor
 * remainder. Returns `null` for singletons, whose copy must stay byte-identical
 * to today's rendering.
 */
export const formatGroupSummary = (group: NotificationGroup): string | null => {
  if (!group.isAggregated) return null;

  const others = Math.max(0, group.actorIds.length - 1);
  // Duplicate events from a single actor (unlike / re-like, retries) must not
  // render as "and 0 others".
  if (others === 0) return null;

  const title = group.representative.title?.trim();
  if (title) {
    return `${title} and ${others} ${others === 1 ? 'other' : 'others'}`;
  }
  return `${group.actorIds.length} people reacted`;
};

/** Aggregate-aware label so screen readers don't only hear the representative. */
export const groupAriaLabel = (group: NotificationGroup): string => {
  const summary = formatGroupSummary(group);
  const base = summary ?? group.representative.title ?? 'Notification';
  const message = group.representative.message?.trim();
  return message ? `${base}. ${message}` : base;
};
