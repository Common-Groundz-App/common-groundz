
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchUnreadCount,
  fetchUnreadMembership,
  fetchActiveMembership,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  mergeNotifications,
  rowCursorKey,
  isOlderThan,
  Notification,
  type NotificationPage,
  type CountStatus,
  type PageError,
} from '@/services/notificationService';
import { useNotificationLane } from '@/hooks/notifications/useNotificationLane';
import {
  useNotificationsRealtime,
  type RealtimeStatus,
} from '@/hooks/notifications/useNotificationsRealtime';
import { useNotificationsRealtimeEnabled } from '@/hooks/useAppConfig';
import {
  applyRealtimeUpdate,
  classifyInsert,
  isRetracted,
  mergeRealtimeRow,
  removeRetractedRows,
} from '@/utils/notificationRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkStatusService } from '@/services/networkStatusService';

const PAGE_SIZE = 20;
const STICKY_READ_LIMIT = 50;
/** Backstop cadence while realtime is `ready`. Polling is never switched off —
 *  a silently dead socket must still self-heal. */
const REALTIME_POLL_INTERVAL = 60000;

// Re-exported for existing consumers; the canonical declarations live alongside
// the data layer in notificationService.
export type { CountStatus, PageError };

/** Per-lane pagination surface handed to the UI. */
export interface LaneView {
  notifications: Notification[];
  hasMore: boolean;
  isLoadingMore: boolean;
  pageError: PageError;
  fetchError: unknown;
  isRecovering: boolean;
  loadMore: (opts?: { force?: boolean }) => void;
  recoverPagination: () => void;
}

/**
 * Public return shape of the hook. Exported so the notifications provider can
 * derive its context contract from it without duplicating types.
 */
export interface UseNotificationsResult {
  /** All-lane rows. Read rows stay in this list. */
  notifications: Notification[];
  /** Unread-lane rows. This is a FILTERED server dataset — rows leave it once
   *  read (modulo sticky rows), so it is not a projection of `notifications`. */
  unreadNotifications: Notification[];
  all: LaneView;
  unread: LaneView;
  /** Global unread total from the server. `null` means "not yet known" — never
   *  coerce to 0, a false zero hides real unread rows. */
  unreadCount: number | null;
  countStatus: CountStatus;
  /** Unread rows in the UNREAD lane's loaded pages, excluding sticky rows. */
  loadedUnreadCount: number;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAllPending: boolean;
  /** Older loaded unread rows could not be revalidated. Distinct from
   *  `pageError` — this must not render pagination failure UI. */
  historyStale: boolean;
  isRevalidating: boolean;
  refreshUnreadHistory: () => Promise<void>;
  /** Drives whether the Unread lane fetches/polls at all. */
  setUnreadLaneActive: (active: boolean) => void;
  isRecovering: boolean;
  loading: boolean;
  isInitialLoad: boolean;
  isUnreadInitialLoad: boolean;
  isRefreshing: boolean;
  markingAsRead: boolean;
  lastRefresh: Date | null;
  isOnline: boolean;
  fetchAll: () => Promise<void>;
  /** Transport state of the realtime channel. Diagnostics only — no correctness
   *  decision in the UI may depend on it. */
  realtimeStatus: RealtimeStatus;
}

export function useNotifications(pollInterval = 10000): UseNotificationsResult {
  const { user, isLoading } = useAuth();
  const { isOnline } = useNetworkStatus();

  // Count of in-flight mark-as-read mutations. State (not a ref) so the spinner
  // actually re-renders, and so overlapping mutations can't clear it early.
  const [pendingReadOps, setPendingReadOps] = useState<number>(0);
  const [markAllPending, setMarkAllPending] = useState<boolean>(false);

  // --- global count state ---------------------------------------------------
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [countStatus, setCountStatus] = useState<CountStatus>('idle');

  // --- unread history revalidation -----------------------------------------
  const [historyStale, setHistoryStale] = useState<boolean>(false);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const revalidationSeqRef = useRef<number>(0);
  // Ownership for the manual Refresh action, so repeated clicks can't launch
  // duplicate head+membership operations.
  const revalidationOwnerRef = useRef<boolean>(false);
  // Set when a validation was discarded because a mutation owned the lane, so
  // exactly one trailing revalidation runs once the gates release — rather than
  // leaving older rows unverified until the next poll.
  const pendingRevalidationRef = useRef<boolean>(false);
  // Separate sequence token for the All lane's ACTIVE-membership revalidation.
  // It shares neither its token nor its ownership with the unread pass: the two
  // answer different questions ("still unread?" vs "still not retracted?") and
  // one superseding the other would leave the other's rows unverified.
  const activeRevalidationSeqRef = useRef<number>(0);
  const pendingActiveRevalidationRef = useRef<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped whenever the authenticated user changes. Captured by every fetch and
  // mutation so work belonging to a previous session commits nothing.
  const userGenerationRef = useRef<number>(0);

  const countSeqRef = useRef<number>(0);
  // Notification ids currently owned by an in-flight mark-as-read mutation.
  // Guarantees exactly one mutation owns a row, so a failed rollback can never
  // contradict a concurrent success on the same row.
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const markAllPendingRef = useRef<boolean>(false);
  // Bumped by every mutation. A count response captured before a mutation
  // started is stale by definition and must not commit.
  const mutationEpochRef = useRef<number>(0);
  const countRefetchQueuedRef = useRef<boolean>(false);

  // Rows read while the Unread tab is open. They stay rendered (as read) so the
  // list does not jump under the user's finger. VISUAL ONLY: excluded from the
  // cursor, loadedUnreadCount, mismatch detection, mark-all eligibility and
  // membership validation.
  const stickyReadIdsRef = useRef<Set<string>>(new Set());

  // Ids realtime has reported as RETRACTED (Phase 2.5). Kept so a fetch that was
  // already in flight when the retraction arrived cannot merge the row back in.
  // Bounded: a tombstone only has to outlive the requests overlapping it.
  const retractedIdsRef = useRef<Set<string>>(new Set());

  // Whether the Unread lane should be doing any work at all.
  const [unreadActive, setUnreadActive] = useState<boolean>(false);
  const unreadActiveRef = useRef<boolean>(false);
  unreadActiveRef.current = unreadActive;

  const baseEnabled = Boolean(user) && !isLoading && isOnline;

  /** True while any read mutation owns rows. Count commits are suppressed and
   *  the mismatch banner is hidden while this holds. */
  const anyMutationPending = useCallback(
    () => pendingReadIdsRef.current.size > 0 || markAllPendingRef.current,
    []
  );

  // --- lanes ----------------------------------------------------------------

  const allLane = useNotificationLane({
    unreadOnly: false,
    pageSize: PAGE_SIZE,
    enabled: baseEnabled,
    generationRef: userGenerationRef,
    isMutationHeld: anyMutationPending,
    reconcilers: {
      // Monotonic reconciliation: a fetch must never turn a locally-read row
      // back to unread. A poll started before an optimistic read can return a
      // stale snapshot, and the pending id may already have been released.
      head: (prev, page) => applyServerRows(mergeNotifications(prev, page.rows)),
      append: (prev, page) => applyServerRows(mergeNotifications(prev, page.rows)),
    },
    onHeadCommitted: (page, isCurrent) => {
      // A head refresh only ever sees the NEWEST window, so it can never notice
      // that a row on page 2+ was retracted. This is the only path that removes
      // those (Phase 2.5).
      void revalidateActiveHistoryRef.current?.(page, isCurrent);
    },
  });


  /**
   * Unread head reconciliation.
   *
   * The head page is AUTHORITATIVE over its own window: any loaded row newer
   * than or equal to the page's oldest row that is absent from the page has
   * left the unread dataset and is removed. Rows older than that boundary are
   * outside the window and are left for membership revalidation.
   *
   * An EMPTY head page means no boundary exists, so nothing can be classified
   * as in-window — every accumulated row is handed to membership validation
   * rather than being blindly dropped or blindly kept.
   */
  const reconcileUnreadHead = useCallback(
    (prev: Notification[], page: NotificationPage): Notification[] => {
      const sticky = stickyReadIdsRef.current;
      const pageIds = new Set(page.rows.map((row) => row.id));
      const boundaryKey =
        page.rows.length > 0 ? rowCursorKey(page.rows[page.rows.length - 1]) : null;

      const retained = prev.filter((row) => {
        if (pageIds.has(row.id)) return true; // refreshed by the page itself
        if (sticky.has(row.id)) return true;  // visual-only hold
        if (boundaryKey === null) return true; // no window — membership decides
        return isOlderThan(rowCursorKey(row), boundaryKey);
      });

      return applyServerRows(mergeNotifications(retained, page.rows));
    },
    []
  );

  const unreadLane = useNotificationLane({
    unreadOnly: true,
    pageSize: PAGE_SIZE,
    enabled: baseEnabled && unreadActive,
    generationRef: userGenerationRef,
    isMutationHeld: anyMutationPending,
    reconcilers: {
      head: reconcileUnreadHead,
      append: (prev, page) => applyServerRows(mergeNotifications(prev, page.rows)),
    },
    onHeadCommitted: (page, isCurrent) => {
      // Sticky rows are cleared atomically with their removal on every
      // successful refresh — clearing the ids without dropping the rows would
      // strand read rows in the unread list.
      const sticky = stickyReadIdsRef.current;
      if (sticky.size > 0) {
        const toDrop = new Set(sticky);
        stickyReadIdsRef.current = new Set();
        unreadLaneRef.current?.dropRowsById(toDrop);
      }
      void revalidateUnreadHistoryRef.current?.(page, isCurrent);
    },
  });

  // Lane handles are needed inside callbacks defined before/around them.
  const unreadLaneRef = useRef(unreadLane);
  unreadLaneRef.current = unreadLane;
  const allLaneRef = useRef(allLane);
  allLaneRef.current = allLane;

  /** Re-applies in-flight optimistic reads on top of any server payload. */
  function applyPendingReads(rows: Notification[]): Notification[] {
    const locallyRead = pendingReadIdsRef.current;
    if (locallyRead.size === 0) return rows;
    return rows.map((row) =>
      !row.is_read && locallyRead.has(row.id) ? { ...row, is_read: true } : row
    );
  }

  /**
   * The single gate every server payload passes through before it becomes lane
   * state: local optimistic reads are re-applied, and rows realtime has already
   * reported as retracted are stripped.
   *
   * The retraction strip matters because a fetch already in flight when the
   * retraction arrived still carries the row (it was active when the query ran),
   * and merging it back would resurrect a notification the user just undid.
   */
  function applyServerRows(rows: Notification[]): Notification[] {
    return applyPendingReads(removeRetractedRows(rows, retractedIdsRef.current));
  }


  /**
   * Canonical cross-lane read state.
   *
   * The same id can sit in both lanes and disagree transiently. Read is
   * MONOTONIC across projections: if either lane says a row is read, it is read.
   * Every mutation decision reads through this — a plain concatenation would
   * double-send RPCs and double-decrement the badge.
   *
   * Valid only while the app has no mark-as-unread action. If that ever ships,
   * replace this (and mergeNotifications' monotonic rule) with row versioning.
   */
  const canonicalRowsById = useCallback((): Map<string, Notification> => {
    const byId = new Map<string, Notification>();
    const absorb = (row: Notification) => {
      const existing = byId.get(row.id);
      byId.set(
        row.id,
        existing ? { ...existing, is_read: existing.is_read || row.is_read } : row
      );
    };
    allLaneRef.current.rowsRef.current.forEach(absorb);
    unreadLaneRef.current.rowsRef.current.forEach(absorb);
    return byId;
  }, []);

  // --- reset on auth change -------------------------------------------------

  useEffect(() => {
    userGenerationRef.current += 1;
    countSeqRef.current += 1;
    mutationEpochRef.current += 1;
    revalidationSeqRef.current += 1;
    activeRevalidationSeqRef.current += 1;
    pendingReadIdsRef.current.clear();
    stickyReadIdsRef.current = new Set();
    retractedIdsRef.current = new Set();
    markAllPendingRef.current = false;
    countRefetchQueuedRef.current = false;
    pendingRevalidationRef.current = false;
    pendingActiveRevalidationRef.current = false;
    revalidationOwnerRef.current = false;
    allLaneRef.current.reset();
    unreadLaneRef.current.reset();
    setPendingReadOps(0);
    setMarkAllPending(false);
    setUnreadCount(null);
    setCountStatus('idle');
    setHistoryStale(false);
    setIsRevalidating(false);
  }, [user?.id]);

  // --- unread membership revalidation ---------------------------------------

  /**
   * Verifies loaded unread rows that sit OUTSIDE the authoritative head window.
   *
   * Without this, a row on unread page 2 that was read on another device never
   * appears in a head refresh and would linger in the list forever.
   *
   * Commit is ATOMIC and all-or-nothing: chunk results are only applied if every
   * chunk resolved and the request is still applicable. A stale row on screen is
   * strictly better than deleting a live one.
   */
  const revalidateUnreadHistory = useCallback(
    async (page: NotificationPage, isHeadCurrent: () => boolean) => {
      const currentUserId = user?.id;
      if (!currentUserId) return;

      const lane = unreadLaneRef.current;
      const sticky = stickyReadIdsRef.current;
      const pageIds = new Set(page.rows.map((row) => row.id));
      const boundaryKey =
        page.rows.length > 0 ? rowCursorKey(page.rows[page.rows.length - 1]) : null;

      const candidateIds = lane.rowsRef.current
        .filter((row) => {
          if (sticky.has(row.id)) return false;
          if (pageIds.has(row.id)) return false;
          // Empty head page => no window => everything needs verifying.
          if (boundaryKey === null) return true;
          return isOlderThan(rowCursorKey(row), boundaryKey);
        })
        .map((row) => row.id);

      if (candidateIds.length === 0) {
        setHistoryStale(false);
        return;
      }

      const generation = userGenerationRef.current;
      revalidationSeqRef.current += 1;
      const seq = revalidationSeqRef.current;
      setIsRevalidating(true);

      /** Is this response still the one that should be allowed to write? */
      const isApplicable = () =>
        generation === userGenerationRef.current &&
        seq === revalidationSeqRef.current &&
        isHeadCurrent();

      try {
        const stillUnread = await fetchUnreadMembership(candidateIds, currentUserId);

        // A superseded / reset / signed-out request writes NOTHING — not even
        // historyStale. Otherwise an old validation could warn about data a
        // newer one has already verified.
        if (!isApplicable()) return;

        if (anyMutationPending()) {
          pendingRevalidationRef.current = true;
          return;
        }

        const stickyNow = stickyReadIdsRef.current;
        const toDrop = new Set(
          candidateIds.filter((id) => !stillUnread.has(id) && !stickyNow.has(id))
        );
        // Single commit. Dropping rows never moves the cursor.
        lane.dropRowsById(toDrop);
        setHistoryStale(false);
      } catch {
        if (!isApplicable()) return;
        if (anyMutationPending()) {
          // Discarded by a gate, not a verdict on the data: retry on release.
          pendingRevalidationRef.current = true;
          return;
        }
        setHistoryStale(true);
      } finally {
        if (
          generation === userGenerationRef.current &&
          seq === revalidationSeqRef.current
        ) {
          setIsRevalidating(false);
        }
      }
    },
    [user?.id, anyMutationPending]
  );

  const revalidateUnreadHistoryRef = useRef(revalidateUnreadHistory);
  revalidateUnreadHistoryRef.current = revalidateUnreadHistory;

  /**
   * All-lane mirror: verifies that loaded rows OUTSIDE the head window are still
   * ACTIVE (not retracted).
   *
   * Needed because retraction is the first thing that can remove a row from the
   * All lane at all. Head refreshes are authoritative only over the newest
   * window, so without this an unliked notification sitting on page 3 would stay
   * on screen until a full reload.
   *
   * Commit is all-or-nothing for the same reason as the unread pass: a partial
   * result is indistinguishable from "these rows were retracted".
   */
  const revalidateActiveHistory = useCallback(
    async (page: NotificationPage, isHeadCurrent: () => boolean) => {
      const currentUserId = user?.id;
      if (!currentUserId) return;

      const lane = allLaneRef.current;
      const pageIds = new Set(page.rows.map((row) => row.id));
      const boundaryKey =
        page.rows.length > 0 ? rowCursorKey(page.rows[page.rows.length - 1]) : null;

      const candidateIds = lane.rowsRef.current
        .filter((row) => {
          if (pageIds.has(row.id)) return false;
          // Empty head page => no window => everything needs verifying.
          if (boundaryKey === null) return true;
          return isOlderThan(rowCursorKey(row), boundaryKey);
        })
        .map((row) => row.id);

      if (candidateIds.length === 0) return;

      const generation = userGenerationRef.current;
      activeRevalidationSeqRef.current += 1;
      const seq = activeRevalidationSeqRef.current;

      const isApplicable = () =>
        generation === userGenerationRef.current &&
        seq === activeRevalidationSeqRef.current &&
        isHeadCurrent();

      try {
        const stillActive = await fetchActiveMembership(candidateIds, currentUserId);
        if (!isApplicable()) return;

        if (anyMutationPending()) {
          pendingActiveRevalidationRef.current = true;
          return;
        }

        const toDrop = new Set(candidateIds.filter((id) => !stillActive.has(id)));
        if (toDrop.size > 0) {
          // Dropping rows never moves the cursor.
          lane.dropRowsById(toDrop);
          // Also drop them from the unread lane: a retracted row is not unread,
          // it does not exist.
          unreadLaneRef.current.dropRowsById(toDrop);
        }
      } catch {
        if (!isApplicable()) return;
        // Retry on gate release rather than surfacing an error: a lingering row
        // is a cosmetic staleness, not a failure the user can act on.
        if (anyMutationPending()) pendingActiveRevalidationRef.current = true;
      }
    },
    [user?.id, anyMutationPending]
  );

  const revalidateActiveHistoryRef = useRef(revalidateActiveHistory);
  revalidateActiveHistoryRef.current = revalidateActiveHistory;

  /**
   * Manual Refresh for the stale-history strip.
   *
   * ONE owner runs ONE coordinated pass over BOTH lanes. Two independently
   * owned passes would compete: whichever finished second would see the other's
   * committed rows and could re-verify or re-drop them, and the shared
   * `historyStale` flag would flap.
   */
  const refreshUnreadHistory = useCallback(async () => {
    if (revalidationOwnerRef.current) return;
    revalidationOwnerRef.current = true;
    try {
      const passes: Promise<void>[] = [allLaneRef.current.refreshHead()];
      if (unreadActiveRef.current) passes.push(unreadLaneRef.current.refreshHead());
      await Promise.all(passes);
    } finally {
      revalidationOwnerRef.current = false;
    }
  }, []);

  // --- count lane -----------------------------------------------------------

  /**
   * Commit rule: a response applies only if its generation is current, it is the
   * newest count request, the mutation epoch is unchanged, and no read mutation
   * is pending. Without this, a count issued after an optimistic decrement but
   * before the DB write commits returns the pre-mutation value and bounces the
   * badge back up.
   */
  const refreshUnreadCount = useCallback(async () => {
    if (!baseEnabled) return;

    const generation = userGenerationRef.current;
    countSeqRef.current += 1;
    const seq = countSeqRef.current;
    const epoch = mutationEpochRef.current;

    setCountStatus('loading');

    try {
      const count = await fetchUnreadCount();

      const canCommit =
        generation === userGenerationRef.current &&
        seq === countSeqRef.current &&
        epoch === mutationEpochRef.current &&
        !anyMutationPending();

      if (!canCommit) {
        if (generation === userGenerationRef.current) {
          countRefetchQueuedRef.current = true;
        }
        return;
      }

      setUnreadCount(count);
      setCountStatus('ready');
    } catch {
      if (generation !== userGenerationRef.current || seq !== countSeqRef.current) return;
      // Preserve the last known good value — never write 0 on failure.
      setCountStatus('error');
    }
  }, [baseEnabled, anyMutationPending]);

  /** Orchestrator for polling and manual retry only. */
  const fetchAll = useCallback(async () => {
    const tasks: Promise<unknown>[] = [allLaneRef.current.refreshHead(), refreshUnreadCount()];
    // Unread only runs while it is actually in use — no permanent second query.
    if (unreadActiveRef.current) tasks.push(unreadLaneRef.current.refreshHead());
    await Promise.all(tasks);
    networkStatusService.reportSuccess();
  }, [refreshUnreadCount]);

  /**
   * Release-before-reconcile. Every mutation path calls this in its `finally`,
   * AFTER releasing its own gate — reconciling before release would fail the
   * count commit rule above. No-ops while any gate is still held, so a burst of
   * five row-reads produces one reconciliation, not five.
   */
  const reconcileAfterMutation = useCallback(() => {
    if (anyMutationPending()) return;
    countRefetchQueuedRef.current = false;
    void allLaneRef.current.refreshHead();
    void refreshUnreadCount();
    if (unreadActiveRef.current) void unreadLaneRef.current.refreshHead();
  }, [refreshUnreadCount, anyMutationPending]);

  // --- mutations ------------------------------------------------------------

  const markAsRead = async (ids: string[]) => {
    if (!user || !ids.length || isLoading) return;
    // Bidirectional exclusivity: mark-all owns every unread row while it runs.
    if (markAllPendingRef.current) return;
    // Recovery may replace a list; an optimistic flip against rows about to be
    // discarded would be rolled back onto unrelated rows.
    if (allLaneRef.current.isRecovering || unreadLaneRef.current.isRecovering) return;

    const generation = userGenerationRef.current;

    // Eligibility and rollback data are derived from the canonical union BEFORE
    // any setter, so the updaters below stay pure and replay-safe.
    const requested = new Set(ids);
    const canonical = canonicalRowsById();
    const eligibleIds: string[] = [];

    requested.forEach((id) => {
      const row = canonical.get(id);
      if (!row || row.is_read) return;
      if (pendingReadIdsRef.current.has(id)) return;
      eligibleIds.push(id);
    });

    if (eligibleIds.length === 0) return;

    // Claim ownership synchronously, before the first await and before render.
    eligibleIds.forEach((id) => pendingReadIdsRef.current.add(id));
    setPendingReadOps((n) => n + 1);
    mutationEpochRef.current += 1;

    const owned = new Set(eligibleIds);

    // While the Unread tab is open, keep the rows rendered so the list does not
    // jump. Bounded, and cleared atomically at every lane boundary.
    if (unreadActiveRef.current) {
      const sticky = stickyReadIdsRef.current;
      owned.forEach((id) => {
        if (sticky.size < STICKY_READ_LIMIT) sticky.add(id);
      });
    }

    const markRead = (row: Notification) => ({ ...row, is_read: true });
    allLaneRef.current.patchRowsById(owned, markRead);
    unreadLaneRef.current.patchRowsById(owned, markRead);

    // Optimistic count decrement from the DEDUPED set, clamped, and only if the
    // count is actually known.
    setUnreadCount((c) => (c === null ? c : Math.max(0, c - eligibleIds.length)));

    try {
      await markNotificationsAsRead(eligibleIds);
    } catch {
      if (generation !== userGenerationRef.current) return;

      // Roll back only the ids this call owned, against the CURRENT lists.
      const restore = (row: Notification) => ({ ...row, is_read: false });
      allLaneRef.current.patchRowsById(owned, restore);
      unreadLaneRef.current.patchRowsById(owned, restore);
      owned.forEach((id) => stickyReadIdsRef.current.delete(id));
      setUnreadCount((c) => (c === null ? c : c + eligibleIds.length));

      toast({
        title: 'Error updating notifications',
        description: 'Failed to mark notifications as read',
        variant: 'destructive',
      });
    } finally {
      if (generation === userGenerationRef.current) {
        eligibleIds.forEach((id) => pendingReadIdsRef.current.delete(id));
        setPendingReadOps((n) => Math.max(0, n - 1));
        reconcileAfterMutation();
      }
    }
  };

  /**
   * Server-side mark-all. Mutually exclusive with individual reads in BOTH
   * directions — without the check below, a row read could fail and roll itself
   * back to unread locally after mark-all had already read it on the server.
   */
  const markAllAsRead = async () => {
    if (!user || isLoading) return;
    if (markAllPendingRef.current) return;
    if (allLaneRef.current.isRecovering || unreadLaneRef.current.isRecovering) {
      toast({ description: 'Finishing previous action…' });
      return;
    }
    if (pendingReadIdsRef.current.size > 0) {
      toast({ description: 'Finishing previous action…' });
      return;
    }

    const generation = userGenerationRef.current;

    // Derived before any setter. NOTE: an empty set does NOT short-circuit the
    // RPC — unread rows older than the loaded pages must still be cleared.
    const canonical = canonicalRowsById();
    const priorUnread = new Set<string>();
    canonical.forEach((row, id) => {
      if (!row.is_read) priorUnread.add(id);
    });
    const unreadRowsSnapshot = unreadLaneRef.current.rowsRef.current;

    markAllPendingRef.current = true;
    setMarkAllPending(true);
    mutationEpochRef.current += 1;

    const markRead = (row: Notification) => (row.is_read ? row : { ...row, is_read: true });
    if (priorUnread.size > 0) {
      allLaneRef.current.patchRowsById(priorUnread, markRead);
      unreadLaneRef.current.patchRowsById(priorUnread, markRead);
    }
    setUnreadCount(0);
    setCountStatus('ready');

    try {
      await markAllNotificationsAsRead();
      if (generation !== userGenerationRef.current) return;

      // Success is authoritative that the unread dataset is now empty. Reset the
      // lane outright — even while inactive — so reopening Unread cannot flash
      // stale rows.
      stickyReadIdsRef.current = new Set();
      pendingRevalidationRef.current = false;
      unreadLaneRef.current.reset();
      setHistoryStale(false);
    } catch {
      if (generation !== userGenerationRef.current) return;

      const restore = (row: Notification) => ({ ...row, is_read: false });
      allLaneRef.current.patchRowsById(priorUnread, restore);
      // The unread lane may have been reset/refreshed meanwhile; restore only
      // rows still present.
      const stillPresent = new Set(
        unreadLaneRef.current.rowsRef.current
          .filter((row) => priorUnread.has(row.id))
          .map((row) => row.id)
      );
      unreadLaneRef.current.patchRowsById(stillPresent, restore);
      void unreadRowsSnapshot;

      // Only undo the zero WE wrote — if something else has since set a real
      // count, leave it alone.
      setUnreadCount((c) => (c === 0 ? null : c));
      setCountStatus((s) => (s === 'ready' ? 'idle' : s));

      toast({
        title: 'Error updating notifications',
        description: 'Failed to mark all notifications as read',
        variant: 'destructive',
      });
    } finally {
      if (generation === userGenerationRef.current) {
        markAllPendingRef.current = false;
        setMarkAllPending(false);
        reconcileAfterMutation();
      }
    }
  };

  // --- realtime -------------------------------------------------------------

  const realtimeFlagEnabled = useNotificationsRealtimeEnabled();

  /**
   * Fold a live INSERT into a lane, but ONLY where doing so keeps that lane's
   * window contiguous. Classification uses the lane's server cursor (what it has
   * fetched), never its rendered rows, which are filtered by sticky reads.
   *
   * Anything skipped here is still covered: every event also schedules a
   * coalesced reconcile, which is the authoritative path.
   */
  const MAX_TRACKED_RETRACTIONS = 500;

  /**
   * Remove a retracted row everywhere, immediately (Phase 2.5).
   *
   * Runs regardless of the mutation gate. A retraction is not an optimistic
   * conflict: the row no longer exists server-side, so there is nothing a
   * pending read could disagree with. The id is remembered so an in-flight fetch
   * that still carries the row cannot merge it back.
   */
  const applyRetraction = useCallback((row: Notification) => {
    const tracked = retractedIdsRef.current;
    // Bounded: a tombstone only needs to outlive the requests overlapping it.
    if (tracked.size >= MAX_TRACKED_RETRACTIONS) tracked.clear();
    tracked.add(row.id);

    pendingReadIdsRef.current.delete(row.id);
    stickyReadIdsRef.current.delete(row.id);

    const toDrop = new Set([row.id]);
    allLaneRef.current.dropRowsById(toDrop);
    unreadLaneRef.current.dropRowsById(toDrop);
    // The badge is NOT adjusted locally: the coalesced reconcile that follows
    // every realtime event re-reads the count RPC, which already excludes
    // retracted rows. Guessing here could double-count against that.
  }, []);

  /**
   * Fold a live INSERT into a lane, but ONLY where doing so keeps that lane's
   * window contiguous. Classification uses the lane's server cursor (what it has
   * fetched), never its rendered rows, which are filtered by sticky reads.
   *
   * Anything skipped here is still covered: every event also schedules a
   * coalesced reconcile, which is the authoritative path.
   */
  const applyRealtimeInsert = useCallback((row: Notification) => {
    // Defensive: an INSERT is never born retracted, but a replayed/backfilled
    // event could be. A tombstone must never enter a lane.
    if (isRetracted(row)) {
      applyRetraction(row);
      return;
    }
    // A mutation owns rows right now; merging would fight the optimistic state.
    if (anyMutationPending()) return;
    if (retractedIdsRef.current.has(row.id)) return;

    const lanes = [
      { lane: allLaneRef.current, accepts: true },
      {
        lane: unreadLaneRef.current,
        // The unread lane is a FILTERED dataset: a read row is not a member.
        accepts: unreadActiveRef.current && !row.is_read,
      },
    ];

    lanes.forEach(({ lane, accepts }) => {
      if (!accepts) return;
      if (!lane.hasLoadedRef.current) return; // nothing loaded to be part of
      if (lane.isRecovering) return;
      const cursor = lane.serverCursorRef.current;
      const boundary = cursor ? rowCursorKey({ created_at: cursor.created_at }) : null;
      if (classifyInsert(row, boundary, lane.hasMoreRef.current) !== 'merge') return;
      lane.replaceRows(applyServerRows(mergeRealtimeRow(lane.rowsRef.current, row)));
    });
  }, [anyMutationPending, applyRetraction]);

  /**
   * Live UPDATE — either a read on another device, or a RETRACTION.
   *
   * Retraction is checked first and is unconditional: it is how "unlike",
   * "unfollow" and "comment deleted" reach the client, and the row must vanish
   * the moment the undo lands rather than at the next poll.
   */
  const applyRealtimeRowUpdate = useCallback((row: Notification) => {
    if (isRetracted(row)) {
      applyRetraction(row);
      return;
    }
    if (anyMutationPending()) return;
    [allLaneRef.current, unreadLaneRef.current].forEach((lane) => {
      if (!lane.hasLoadedRef.current) return;
      if (lane.isRecovering) return;
      const next = applyRealtimeUpdate(lane.rowsRef.current, row);
      if (next !== lane.rowsRef.current) lane.replaceRows(applyServerRows(next));
    });
  }, [anyMutationPending, applyRetraction]);


  const fetchAllRef = useRef<() => Promise<void>>();
  fetchAllRef.current = fetchAll;

  const { status: realtimeStatus } = useNotificationsRealtime({
    userId: user?.id,
    enabled: baseEnabled && realtimeFlagEnabled,
    onInsert: applyRealtimeInsert,
    onUpdate: applyRealtimeRowUpdate,
    // Head refresh + count: the same authoritative path polling uses.
    onReconcile: async () => {
      await fetchAllRef.current?.();
    },
  });

  // --- gate drains ----------------------------------------------------------

  // Count refetch dropped by the commit gate, drained once mutations settle.
  useEffect(() => {
    if (pendingReadOps === 0 && !markAllPending && countRefetchQueuedRef.current) {
      countRefetchQueuedRef.current = false;
      void refreshUnreadCount();
    }
  }, [pendingReadOps, markAllPending, refreshUnreadCount]);

  // Membership validation discarded by a mutation gate: run exactly one trailing
  // revalidation on release, rather than leaving older rows unverified until the
  // next poll. Coalesced — many discards produce one retry.
  useEffect(() => {
    if (pendingReadOps > 0 || markAllPending) return;
    if (!pendingRevalidationRef.current) return;
    pendingRevalidationRef.current = false;
    if (!unreadActiveRef.current) return;
    void unreadLaneRef.current.refreshHead();
  }, [pendingReadOps, markAllPending]);

  // Same drain for the All lane's ACTIVE-membership pass (Phase 2.5).
  useEffect(() => {
    if (pendingReadOps > 0 || markAllPending) return;
    if (!pendingActiveRevalidationRef.current) return;
    pendingActiveRevalidationRef.current = false;
    void allLaneRef.current.refreshHead();
  }, [pendingReadOps, markAllPending]);

  // --- unread lane lifecycle ------------------------------------------------

  const setUnreadLaneActive = useCallback((active: boolean) => {
    setUnreadActive(active);
  }, []);

  useEffect(() => {
    if (!unreadActive) {
      // Leaving the tab / closing the drawer: drop sticky rows and their ids in
      // one commit. Rows and cursor are retained for the session; returning
      // revalidates before they are trusted again.
      const sticky = stickyReadIdsRef.current;
      if (sticky.size > 0) {
        const toDrop = new Set(sticky);
        stickyReadIdsRef.current = new Set();
        unreadLaneRef.current.dropRowsById(toDrop);
      }
      return;
    }
    if (!baseEnabled) return;
    void unreadLaneRef.current.refreshHead();
  }, [unreadActive, baseEnabled]);

  // --- polling --------------------------------------------------------------

  // Realtime is a latency optimization, never a replacement: when the channel is
  // live the backstop poll simply slows down.
  const effectivePollInterval =
    realtimeStatus === 'ready' ? Math.max(pollInterval, REALTIME_POLL_INTERVAL) : pollInterval;

  useEffect(() => {
    if (!user || isLoading) return;

    void fetchAll();

    // Self-rescheduling setTimeout (per background-timer-policy).
    const scheduleNext = () => {
      timerRef.current = setTimeout(async () => {
        if (document.hidden) {
          scheduleNext();
          return;
        }
        await fetchAll();
        scheduleNext();
      }, effectivePollInterval);
    };

    scheduleNext();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user, isLoading, fetchAll, effectivePollInterval]);

  // --- derived --------------------------------------------------------------

  const sticky = stickyReadIdsRef.current;
  // Sticky rows are read; they must never inflate this. Never `rows.length`.
  const loadedUnreadCount = unreadLane.rows.filter(
    (row) => !row.is_read && !sticky.has(row.id)
  ).length;

  const isRecovering = allLane.isRecovering || unreadLane.isRecovering;

  const all: LaneView = {
    notifications: allLane.rows,
    hasMore: allLane.hasMore,
    isLoadingMore: allLane.isLoadingMore,
    pageError: allLane.pageError,
    fetchError: allLane.fetchError,
    isRecovering: allLane.isRecovering,
    loadMore: allLane.loadMore,
    recoverPagination: () => {
      void allLane.recoverPagination().then((ok) => {
        if (ok) void refreshUnreadCount();
      });
    },
  };

  const unread: LaneView = {
    notifications: unreadLane.rows,
    hasMore: unreadLane.hasMore,
    isLoadingMore: unreadLane.isLoadingMore,
    pageError: unreadLane.pageError,
    fetchError: unreadLane.fetchError,
    isRecovering: unreadLane.isRecovering,
    loadMore: unreadLane.loadMore,
    recoverPagination: () => {
      void unreadLane.recoverPagination().then((ok) => {
        if (ok) void refreshUnreadCount();
      });
    },
  };

  return {
    notifications: allLane.rows,
    unreadNotifications: unreadLane.rows,
    all,
    unread,
    unreadCount,
    countStatus,
    loadedUnreadCount,
    markAsRead,
    markAllAsRead,
    markAllPending,
    historyStale,
    isRevalidating,
    refreshUnreadHistory,
    setUnreadLaneActive,
    isRecovering,
    // `loading` means "first load, nothing to show yet" — background polls never
    // flip it, so existing rows are never replaced by loading UI.
    loading: allLane.isInitialLoad,
    isInitialLoad: allLane.isInitialLoad,
    isUnreadInitialLoad: unreadLane.isInitialLoad,
    isRefreshing: allLane.isRefreshing,
    markingAsRead: pendingReadOps > 0,
    lastRefresh: allLane.lastRefresh,
    isOnline,
    fetchAll,
    realtimeStatus,
  };
}
