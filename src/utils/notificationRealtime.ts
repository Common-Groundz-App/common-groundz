/**
 * Phase 2.4 — Step 1: the pure realtime layer.
 *
 * Nothing in this module talks to Supabase, React, or timers-as-globals. It
 * exists so that every risky decision in the realtime path — "is this payload
 * even a notification?", "does this row belong inside the window we have
 * loaded?", "how do I fold it in without breaking order?" — is a total function
 * that can be unit-tested without a socket.
 *
 * DESIGN INVARIANT: realtime is a *delivery hint*, never a source of truth.
 *   - The unread count comes from the count RPC.
 *   - Membership/ordering comes from the lane's own fetches.
 * A dropped, duplicated, or out-of-order realtime event must therefore only ever
 * cost latency, never correctness.
 */

import {
  compareCursorKeys,
  mergeNotifications,
  rowCursorKey,
  tryCursorKey,
  type EntityType,
  type Notification,
  type NotificationType,
} from '@/services/notificationService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'like',
  'comment',
  'follow',
  'system',
  'journey_watched',
  'journey_digest',
];

const ENTITY_TYPES: readonly EntityType[] = [
  'post',
  'recommendation',
  'review',
  'profile',
  'system',
  'journey',
];

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

const isOptionalUuid = (value: unknown): boolean =>
  value === null || value === undefined || isUuid(value);

const isOptionalString = (value: unknown): boolean =>
  value === null || value === undefined || typeof value === 'string';

/**
 * Validate a `postgres_changes` row into a real `Notification`.
 *
 * Returns `null` — never throws — for anything that isn't a fully-formed row for
 * `expectedUserId`. Callers treat `null` as "unknown event: reconcile instead of
 * merging", which is always safe.
 *
 * The `expectedUserId` check is defence in depth. The channel is already
 * filtered server-side (`user_id=eq.<uid>`) and RLS scopes the publication, but
 * a row for another user must never be able to reach local state.
 */
export const validateRealtimePayload = (
  raw: unknown,
  expectedUserId: string
): Notification | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!isUuid(expectedUserId)) return null;

  const row = raw as Record<string, unknown>;

  if (!isUuid(row.id)) return null;
  if (!isUuid(row.user_id) || row.user_id !== expectedUserId) return null;

  if (typeof row.type !== 'string') return null;
  if (!NOTIFICATION_TYPES.includes(row.type as NotificationType)) return null;

  if (typeof row.title !== 'string') return null;
  if (typeof row.message !== 'string') return null;
  if (typeof row.is_read !== 'boolean') return null;

  if (!isOptionalUuid(row.sender_id)) return null;
  if (!isOptionalUuid(row.entity_id)) return null;
  if (!isOptionalString(row.image_url)) return null;
  if (!isOptionalString(row.action_url)) return null;

  if (
    row.entity_type !== null &&
    row.entity_type !== undefined &&
    !ENTITY_TYPES.includes(row.entity_type as EntityType)
  ) {
    return null;
  }

  // Ordering is derived exclusively from `created_at`; an unkeyable timestamp
  // would poison sorting and cursor comparison, so it fails validation here
  // rather than reaching state.
  if (tryCursorKey(row.created_at) === null) return null;
  if (typeof row.updated_at !== 'string') return null;

  let metadata: Notification['metadata'];
  if (row.metadata !== null && row.metadata !== undefined) {
    if (typeof row.metadata !== 'object' || Array.isArray(row.metadata)) return null;
    metadata = row.metadata as Notification['metadata'];
  }

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    type: row.type as NotificationType,
    sender_id: (row.sender_id as string | null) ?? undefined,
    title: row.title as string,
    message: row.message as string,
    entity_type: (row.entity_type as EntityType | null) ?? undefined,
    entity_id: (row.entity_id as string | null) ?? undefined,
    is_read: row.is_read as boolean,
    image_url: (row.image_url as string | null) ?? null,
    action_url: (row.action_url as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    metadata,
  };
};

/**
 * What a lane should do with a validated INSERT.
 *
 *   'merge'     — the row falls inside the contiguous window this lane has
 *                 loaded, so folding it in keeps the window contiguous.
 *   'out-of-window' — the row is older than the lane's loaded boundary, so it
 *                 belongs to a page the user hasn't paged to yet. Merging would
 *                 create a hole; the lane leaves it for pagination.
 */
export type InsertDisposition = 'merge' | 'out-of-window';

/**
 * Classify against the lane's SERVER CURSOR (the boundary of what has been
 * fetched), never against the rendered rows. Rendered rows can be filtered
 * (e.g. the unread lane's sticky reads), so using them would misclassify.
 *
 * `serverCursorKey` is the cursor key of the oldest fetched row, or `null` when
 * nothing has been fetched yet. `hasMore === false` means the lane has reached
 * the end of the list, so no page can exist below it and everything merges.
 */
export const classifyInsert = (
  row: Notification,
  serverCursorKey: string | null,
  hasMore: boolean
): InsertDisposition => {
  if (!hasMore) return 'merge';
  if (serverCursorKey === null) return 'out-of-window';
  // compareCursorKeys is DESC-oriented: <= 0 means row is newer or equal.
  return compareCursorKeys(rowCursorKey(row), serverCursorKey) <= 0
    ? 'merge'
    : 'out-of-window';
};

/**
 * Fold a realtime row into a lane's rows. Pure; delegates de-dup and ordering
 * to `mergeNotifications` so realtime can never introduce a second ordering
 * authority.
 */
export const mergeRealtimeRow = (
  rows: Notification[],
  row: Notification
): Notification[] => mergeNotifications(rows, [row]);

/**
 * Apply a validated UPDATE to already-loaded rows only.
 *
 * An UPDATE for a row we never loaded is intentionally dropped: inserting it
 * here would fabricate window membership out of an edit event.
 */
export const applyRealtimeUpdate = (
  rows: Notification[],
  row: Notification
): Notification[] => {
  if (!rows.some((existing) => existing.id === row.id)) return rows;
  return rows.map((existing) =>
    existing.id === row.id ? { ...existing, ...row } : existing
  );
};

export interface TrailingScheduler {
  /** Request a run. Repeated calls inside the window collapse into one. */
  schedule: () => void;
  /** Run now if a run is pending. */
  flush: () => void;
  /** Drop any pending run. Safe to call repeatedly. */
  cancel: () => void;
  /** Test/debug affordance. */
  isPending: () => boolean;
}

/**
 * Trailing-edge coalescer. A burst of N events (a like storm, a rejoin
 * backfill) must trigger exactly ONE reconcile, at the END of the burst — a
 * leading-edge debounce would fire on the first event and miss the rest.
 *
 * `now`/`setTimer`/`clearTimer` are injected so tests can drive it with fake
 * timers without patching globals.
 */
export const createTrailingScheduler = (
  run: () => void,
  delayMs: number,
  timers: {
    setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  } = {}
): TrailingScheduler => {
  const setTimer = timers.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = timers.clearTimer ?? ((handle) => clearTimeout(handle));

  let handle: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (handle !== null) {
      clearTimer(handle);
      handle = null;
    }
  };

  const fire = () => {
    handle = null;
    run();
  };

  return {
    schedule: () => {
      // Restart the window so the run always lands after the burst settles.
      cancel();
      handle = setTimer(fire, delayMs);
    },
    flush: () => {
      if (handle === null) return;
      cancel();
      run();
    },
    cancel,
    isPending: () => handle !== null,
  };
};
