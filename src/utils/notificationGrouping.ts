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

/** A row may participate in aggregation only if all of these hold.
 *  `sender_id` MUST be valid — otherwise a group can end up with fewer distinct
 *  actors than events, and the "and N others" arithmetic silently under-counts. */
export const isGroupableNotification = (n: Notification): boolean =>
  n.type === 'like' &&
  typeof n.sender_id === 'string' &&
  UUID_RE.test(n.sender_id) &&
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

/* ------------------------------------------------------------------------ *
 * Copy
 *
 * DB rows carry copy in two different shapes:
 *   - mention / reply  → `title` is the sentence, `message` is the comment text
 *   - like / comment   → `title` is a generic label ("New like"), `message` is
 *                        the sentence
 *   - comment like     → `title` is the sentence, `message` is EMPTY
 * The UI never renders a generic header line. When we can verify who the actor
 * is, we synthesise an event-aware sentence from their display name; otherwise
 * we fall back to whatever sentence the database already stored.
 * ------------------------------------------------------------------------ */

const isSentenceTitleEvent = (n: Notification): boolean => {
  const event = n.metadata?.event;
  return event === 'mention' || event === 'reply';
};

/** The stored-copy line — used verbatim whenever we can't verify the actor. */
export const formatSingleLine = (n: Notification): string => {
  const title = n.title?.trim();
  const message = n.message?.trim();
  if (isSentenceTitleEvent(n)) return title || message || 'New notification';
  return message || title || 'New notification';
};

/** Optional second line — comment/reply/mention content only. Never duplicates
 *  the primary line. */
export const getPreviewLine = (n: Notification): string | null => {
  const primary = formatSingleLine(n);
  const candidates = [
    isSentenceTitleEvent(n) ? n.message : undefined,
    typeof n.metadata?.comment_text === 'string' ? n.metadata.comment_text : undefined,
  ];
  for (const c of candidates) {
    const text = c?.trim();
    if (text && text !== primary) return text;
  }
  return null;
};

const targetNoun = (n: Notification): string =>
  n.entity_type === 'recommendation' ? 'your recommendation' : 'your post';

/* --- Actor name resolution -------------------------------------------------
 *
 * A profile is only trusted when it actually belongs to the actor we asked for.
 * `enhancedUnifiedProfileService` returns a synthetic fallback profile (id: '',
 * name: "Anonymous User") on miss, and rendering that would produce copy like
 * "Anonymous User liked your post" — worse than the stored sentence.
 * -------------------------------------------------------------------------- */

const SENTINEL_NAMES = new Set(['anonymous user', 'unknown user', 'deleted user']);

interface ActorProfileLike {
  id?: string | null;
  displayName?: string | null;
  username?: string | null;
}

const usableName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return SENTINEL_NAMES.has(trimmed.toLowerCase()) ? null : trimmed;
};

/** Display name first, username second — both only from a VERIFIED profile.
 *  Returns null when the row should keep its stored database copy. */
export const resolveActorName = (
  profile: ActorProfileLike | null | undefined,
  actorId: string | null | undefined
): string | null => {
  if (!profile || !actorId) return null;
  if (profile.id !== actorId) return null; // covers the id:'' fallback profile
  return usableName(profile.displayName) ?? usableName(profile.username);
};

/* --- Event-aware sentences -------------------------------------------------
 *
 * Precedence matters. Mentions and replies also carry `metadata.comment_id`, so
 * they must claim their rows BEFORE any comment-like check runs.
 * -------------------------------------------------------------------------- */

/**
 * Comment likes are emitted by `toggle_comment_like` as
 * `type: 'comment'` + `metadata.event: 'like'` + `metadata.comment_id` —
 * NOT as `type: 'like'`. A legacy/fixture shape uses `event: 'comment_like'`.
 * Both must be recognised or a comment like renders as "commented on your post".
 */
export const isCommentLike = (n: Notification): boolean => {
  if (!n.metadata?.comment_id) return false;
  const event = n.metadata?.event;
  if (event === 'comment_like') return true;
  if (n.type === 'comment' && event === 'like') return true;
  if (n.type === 'like') return true; // defensive: alternate emitted shape
  return false;
};

/** Event-aware sentence for a KNOWN actor. Returns null for shapes we don't
 *  have first-party copy for, so the caller falls back to stored copy. */
const eventSentence = (n: Notification, name: string): string | null => {
  const event = n.metadata?.event;
  if (event === 'mention') return `${name} mentioned you`;
  if (event === 'reply') return `${name} replied to your comment`;
  if (isCommentLike(n)) return `${name} liked your comment`;
  if (n.type === 'comment') return `${name} commented on ${targetNoun(n)}`;
  if (n.type === 'like') return `${name} liked ${targetNoun(n)}`;
  if (n.type === 'follow') return `${name} followed you`;
  return null;
};

/**
 * The single line a non-aggregated row shows.
 *
 * `name` is a name already resolved via `resolveActorName`. When it is null
 * (profile still loading, unresolved, or a fallback sentinel) the row keeps its
 * stored database sentence — the text swaps in place once a name resolves.
 */
export const formatRowPrimary = (
  n: Notification,
  name: string | null = null
): string => {
  if (name) {
    const sentence = eventSentence(n, name);
    if (sentence) return sentence;
  }
  return formatSingleLine(n);
};

/**
 * Primary line for a group.
 *
 * `names` are names already resolved by the caller for the FIRST actors
 * (in `group.actorIds` order). The "and N others" remainder is computed against
 * distinct actors minus the names actually rendered, so it is never off by one
 * and never claims a name we could not resolve.
 */
export const formatGroupPrimary = (
  group: NotificationGroup,
  names: (string | null)[] = []
): string => {
  const shown = names.filter((n): n is string => !!n?.trim()).slice(0, 2);

  if (!group.isAggregated) return formatRowPrimary(group.representative, shown[0] ?? null);

  const distinct = group.actorIds.length;
  // Repeat events from one actor (unlike / re-like, retries) stay personal.
  if (distinct <= 1) return formatRowPrimary(group.representative, shown[0] ?? null);

  const others = Math.max(0, distinct - shown.length);
  const noun = targetNoun(group.representative);
  const otherLabel = `${others} ${others === 1 ? 'other' : 'others'}`;

  if (shown.length === 0) return `${distinct} people liked ${noun}`;
  if (shown.length === 1) {
    return others > 0
      ? `${shown[0]} and ${otherLabel} liked ${noun}`
      : formatRowPrimary(group.representative, shown[0]);
  }
  return others > 0
    ? `${shown[0]}, ${shown[1]} and ${otherLabel} liked ${noun}`
    : `${shown[0]} and ${shown[1]} liked ${noun}`;
};

/** Aggregate-aware label so screen readers hear exactly the visible sentence. */
export const groupAriaLabel = (
  group: NotificationGroup,
  names: (string | null)[] = []
): string => {
  const base = formatGroupPrimary(group, names);
  const preview = getPreviewLine(group.representative);
  return preview ? `${base}. ${preview}` : base;
};

