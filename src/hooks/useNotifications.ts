
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  mergeNotifications,
  isValidCursor,
  InvalidCursorError,
  Notification,
  NotificationCursor,
  type CountStatus,
  type PageError,
} from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkStatusService } from '@/services/networkStatusService';

const PAGE_SIZE = 20;

// Re-exported for existing consumers; the canonical declarations live alongside
// the data layer in notificationService.
export type { CountStatus, PageError };


/**
 * Public return shape of the hook. Exported so the notifications provider can
 * derive its context contract from it without duplicating types.
 */
export interface UseNotificationsResult {
  notifications: Notification[];
  unreadNotifications: Notification[];
  /** Global unread total from the server. `null` means "not yet known" — never
   *  coerce to 0, a false zero hides real unread rows. */
  unreadCount: number | null;
  countStatus: CountStatus;
  /** Unread rows among the pages actually loaded. Always a number. */
  loadedUnreadCount: number;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAllPending: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  pageError: PageError;
  loadMore: (opts?: { force?: boolean }) => Promise<void>;
  /** Recovers pagination after a structurally invalid cursor. Never blanks the
   *  list: rows stay visible until a replacement page has actually arrived. */
  recoverPagination: () => Promise<void>;
  isRecovering: boolean;
  loading: boolean;
  isInitialLoad: boolean;
  isRefreshing: boolean;
  markingAsRead: boolean;
  fetchError: unknown;
  lastRefresh: Date | null;
  isOnline: boolean;
  fetchAll: () => Promise<void>;
}

export function useNotifications(pollInterval = 10000): UseNotificationsResult {
  const { user, isLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  // Count of in-flight mark-as-read mutations. State (not a ref) so the spinner
  // actually re-renders, and so overlapping mutations can't clear it early.
  const [pendingReadOps, setPendingReadOps] = useState<number>(0);
  const [markAllPending, setMarkAllPending] = useState<boolean>(false);
  // Fetch-only error channel. Mutation failures never write here — they roll
  // back per-id and surface a toast — so the drawer's refresh UI can't be
  // triggered by a failed mark-as-read. Pagination failures use `pageError`.
  const [fetchError, setFetchError] = useState<unknown>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // --- global count state ---------------------------------------------------
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [countStatus, setCountStatus] = useState<CountStatus>('idle');

  // --- pagination state -----------------------------------------------------
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [pageError, setPageError] = useState<PageError>(null);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  // Oldest successfully loaded row. Head refreshes never move it.
  const cursorRef = useRef<NotificationCursor | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether a fetch has ever succeeded for the current user.
  // Kept in a ref (not state) so it never enters refreshHead's dependency list —
  // otherwise every response would recreate it and restart the poller.
  const hasLoadedRef = useRef<boolean>(false);
  // Bumped whenever the authenticated user changes. Captured by every fetch and
  // mutation so work belonging to a previous session commits nothing.
  const userGenerationRef = useRef<number>(0);

  // --- three independent request lanes --------------------------------------
  // Head, count and page each get their own sequence guard, so a slow count can
  // never invalidate a fresh head response (or vice versa).
  const requestSeqRef = useRef<number>(0);
  const countSeqRef = useRef<number>(0);
  const pageReqRef = useRef<number>(0);

  // Synchronous ownership token for the page lane, holding the pageReqRef seq of
  // the request that currently owns it. `isLoadingMore` is React state and does
  // NOT settle within a tick, so two same-tick callers (observer + button) would
  // both see `false` and both hit the network. A TOKEN rather than a boolean:
  // an obsolete request whose ownership was revoked by a reset or by recovery
  // must never release a lock that a newer request has since taken.
  const pageOwnerRef = useRef<number | null>(null);

  // Notification ids currently owned by an in-flight mark-as-read mutation.
  // Guarantees exactly one mutation owns a row, so a failed rollback can never
  // contradict a concurrent success on the same row.
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  // Mirrors `markAllPending` for synchronous reads inside async flows.
  const markAllPendingRef = useRef<boolean>(false);
  // Mirrors `isRecovering`. Pagination recovery and read mutations are mutually
  // exclusive in BOTH directions: a reset that replaces the list mid-mutation
  // would resurrect optimistic read state against rows the mutation never owned.
  const isRecoveringRef = useRef<boolean>(false);
  // Bumped by every mutation. A count response captured before a mutation
  // started is stale by definition and must not commit.
  const mutationEpochRef = useRef<number>(0);
  // Set when a count response was dropped by the gate, so exactly one trailing
  // refetch happens once the gates clear.
  const countRefetchQueuedRef = useRef<boolean>(false);

  // Read-only mirror of `notifications`, so mutation eligibility and rollback
  // data can be derived BEFORE calling setNotifications. React may invoke an
  // updater callback more than once (Strict Mode, replays), so deriving RPC
  // ownership inside one can yield duplicated or empty id sets.
  const notificationsRef = useRef<Notification[]>(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  /** True while any read mutation owns rows. Count commits are suppressed and
   *  the mismatch banner is hidden while this holds. */
  const anyMutationPending = () =>
    pendingReadIdsRef.current.size > 0 || markAllPendingRef.current;

  // Reset all per-user state when the authenticated user changes, so a previous
  // session's rows/cursor/count/errors/mutations can never leak into the next.
  useEffect(() => {
    userGenerationRef.current += 1;
    requestSeqRef.current += 1;
    countSeqRef.current += 1;
    pageReqRef.current += 1;
    mutationEpochRef.current += 1;
    hasLoadedRef.current = false;
    pendingReadIdsRef.current.clear();
    markAllPendingRef.current = false;
    isRecoveringRef.current = false;
    countRefetchQueuedRef.current = false;
    cursorRef.current = null;
    // Revoke page ownership outright. The obsolete request still in flight can
    // no longer release it, because its token no longer matches.
    pageOwnerRef.current = null;
    setPendingReadOps(0);
    setMarkAllPending(false);
    setNotifications([]);
    setFetchError(null);
    setLastRefresh(null);
    setIsRefreshing(false);
    setIsInitialLoad(false);
    setUnreadCount(null);
    setCountStatus('idle');
    setHasMore(false);
    setIsLoadingMore(false);
    setIsRecovering(false);
    setPageError(null);
  }, [user?.id]);

  /**
   * Refreshes the newest page only. Deliberately does NOT request the count —
   * keeping the lanes separate is what lets post-mutation reconciliation fire
   * exactly one head request and one count request.
   */
  const refreshHead = useCallback(async () => {
    if (!user || isLoading || !isOnline) return;

    const generation = userGenerationRef.current;
    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    const isCurrent = () =>
      generation === userGenerationRef.current && seq === requestSeqRef.current;

    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoad(true);
    }

    try {
      const page = await fetchNotifications({ limit: PAGE_SIZE });
      if (!isCurrent()) return;

      const isFirstLoad = !hasLoadedRef.current;

      // Monotonic reconciliation via the shared merge helper: a fetch must never
      // turn a locally-read row back to unread. A poll started before an
      // optimistic read can return a stale snapshot, and the pending id may
      // already have been released by the time it lands.
      setNotifications((prev) => {
        const merged = mergeNotifications(prev, page.rows);
        const locallyRead = pendingReadIdsRef.current;
        return locallyRead.size === 0
          ? merged
          : merged.map((row) =>
              !row.is_read && locallyRead.has(row.id) ? { ...row, is_read: true } : row
            );
      });

      // Only the very first load establishes the cursor and hasMore. Later head
      // refreshes must not rewind pagination to page 1.
      if (isFirstLoad) {
        cursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
      }

      setLastRefresh(new Date());
      hasLoadedRef.current = true;
      // Clear any previous failure so a recovered fetch doesn't leave stale error UI
      setFetchError(null);
      networkStatusService.reportSuccess();
    } catch (e) {
      if (!isCurrent()) return;
      setFetchError(e);
      networkStatusService.reportFailure(e);
      // Background fetch — fail silently (no toast)
    } finally {
      if (isCurrent()) {
        setIsInitialLoad(false);
        setIsRefreshing(false);
      }
    }
  }, [user, isLoading, isOnline]);

  /**
   * Refreshes the global unread count.
   *
   * Commit rule: a response applies only if its generation is current, it is the
   * newest count request, the mutation epoch is unchanged, and no read mutation
   * is pending. Without this, a count issued after an optimistic decrement but
   * before the DB write commits returns the pre-mutation value and bounces the
   * badge back up.
   */
  const refreshUnreadCount = useCallback(async () => {
    if (!user || isLoading || !isOnline) return;

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
        // Queue exactly one trailing refetch for when the gates clear.
        if (generation === userGenerationRef.current) {
          countRefetchQueuedRef.current = true;
        }
        return;
      }

      setUnreadCount(count);
      setCountStatus('ready');
    } catch {
      if (generation !== userGenerationRef.current || seq !== countSeqRef.current) return;
      // Preserve the last known good value — never write 0 on failure, and
      // never write to fetchError (this is not a list refresh failure).
      setCountStatus('error');
    }
  }, [user, isLoading, isOnline]);

  /** Orchestrator for polling and manual retry only. Mutation settlement calls
   *  the two lanes directly so it can guarantee a single count request. */
  const fetchAll = useCallback(async () => {
    await Promise.all([refreshHead(), refreshUnreadCount()]);
  }, [refreshHead, refreshUnreadCount]);

  /**
   * Release-before-reconcile.
   *
   * Every mutation path calls this in its `finally`, AFTER releasing its own
   * gate. Reconciling before release would fail the count commit rule above and
   * the response would be discarded. Because it no-ops while any gate is still
   * held, a burst of five row-reads produces one reconciliation, not five.
   */
  const reconcileAfterMutation = useCallback(() => {
    if (anyMutationPending()) return;
    countRefetchQueuedRef.current = false;
    void refreshHead();
    void refreshUnreadCount();
  }, [refreshHead, refreshUnreadCount]);

  const markAsRead = async (ids: string[]) => {
    if (!user || !ids.length || isLoading) return;
    // Bidirectional exclusivity: mark-all owns every unread row while it runs.
    if (markAllPendingRef.current) return;
    // Recovery may replace the whole list; an optimistic flip against rows that
    // are about to be discarded would be rolled back onto unrelated rows.
    if (isRecoveringRef.current) return;

    const generation = userGenerationRef.current;

    // Eligibility and rollback data are derived from the ref BEFORE any setter,
    // so the updater below stays pure and replay-safe. Same-id overlap is
    // impossible because pendingReadIdsRef is claimed synchronously below, and
    // the updater itself is idempotent (it only ever sets is_read: true).
    const requested = new Set(ids);
    const priorReadState = new Map<string, boolean>();
    const eligibleIds: string[] = [];

    notificationsRef.current.forEach((row) => {
      if (!requested.has(row.id)) return;
      if (row.is_read) return;
      if (pendingReadIdsRef.current.has(row.id)) return;
      priorReadState.set(row.id, row.is_read);
      eligibleIds.push(row.id);
    });

    // Nothing to do — don't take ownership and don't move the spinner.
    if (eligibleIds.length === 0) return;

    // Claim ownership synchronously, before the first await and before render.
    eligibleIds.forEach((id) => pendingReadIdsRef.current.add(id));
    setPendingReadOps((n) => n + 1);
    mutationEpochRef.current += 1;

    const owned = new Set(eligibleIds);
    setNotifications((prev) =>
      prev.map((row) => (owned.has(row.id) ? { ...row, is_read: true } : row))
    );

    // Optimistic count decrement, clamped. Only if the count is actually known.
    setUnreadCount((c) => (c === null ? c : Math.max(0, c - eligibleIds.length)));

    try {
      await markNotificationsAsRead(eligibleIds);
    } catch (e) {
      // A mutation from a previous session must not touch the new session.
      if (generation !== userGenerationRef.current) return;

      // Roll back only the ids this call owned, to their exact prior values,
      // against the CURRENT list — never a whole-array snapshot.
      setNotifications((prev) =>
        prev.map((row) =>
          priorReadState.has(row.id)
            ? { ...row, is_read: priorReadState.get(row.id) as boolean }
            : row
        )
      );
      // Re-add exactly the delta this call removed, and only if a count exists.
      setUnreadCount((c) => (c === null ? c : c + eligibleIds.length));

      // User-triggered action — toast is appropriate. Deliberately does not set
      // fetchError: this is not a refresh failure.
      toast({
        title: "Error updating notifications",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      });
    } finally {
      // Stale-generation mutations skip release entirely; the user-change reset
      // already cleared the pending set and the counter.
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
    if (isRecoveringRef.current) {
      toast({ description: 'Finishing previous action…' });
      return;
    }
    if (pendingReadIdsRef.current.size > 0) {
      toast({ description: 'Finishing previous action…' });
      return;
    }

    const generation = userGenerationRef.current;

    // Derived from the ref before the setter, so the updater stays pure.
    // NOTE: an empty map does NOT short-circuit the RPC — unread rows older than
    // the loaded pages must still be cleared server-side.
    const priorReadState = new Map<string, boolean>();
    notificationsRef.current.forEach((row) => {
      if (!row.is_read) priorReadState.set(row.id, row.is_read);
    });

    markAllPendingRef.current = true;
    setMarkAllPending(true);
    mutationEpochRef.current += 1;

    if (priorReadState.size > 0) {
      setNotifications((prev) =>
        prev.map((row) => (row.is_read ? row : { ...row, is_read: true }))
      );
    }
    setUnreadCount(0);
    setCountStatus('ready');

    try {
      await markAllNotificationsAsRead();
    } catch (e) {
      if (generation !== userGenerationRef.current) return;

      setNotifications((prev) =>
        prev.map((row) =>
          priorReadState.has(row.id)
            ? { ...row, is_read: priorReadState.get(row.id) as boolean }
            : row
        )
      );
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

  /**
   * Loads the next page from the keyset cursor.
   *
   * `force` exists because the guard below refuses to run while `pageError` is
   * set — without a bypass the Retry button would be permanently inert. The
   * IntersectionObserver always calls the UNFORCED variant, so it can never
   * retry-loop against a broken cursor; only the explicit button can.
   */
  const loadMore = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;

      if (!user || isLoading || !isOnline) return;
      if (!hasMore) return;
      if (isLoadingMore) return;
      // Synchronous lane ownership. `isLoadingMore` above is React state and
      // does not settle within a tick, so this is the guard that actually stops
      // the observer and the button from firing the same request twice.
      if (pageOwnerRef.current !== null) return;
      // Mark-all rewrites every unread row; appending a page mid-flight would
      // land rows that the mutation never covered.
      if (markAllPendingRef.current) return;
      if (isRecoveringRef.current) return;
      if (pageError && !force) return;

      const cursor = cursorRef.current;
      if (!cursor) {
        setHasMore(false);
        return;
      }

      if (force) setPageError(null);

      const generation = userGenerationRef.current;
      pageReqRef.current += 1;
      const seq = pageReqRef.current;
      pageOwnerRef.current = seq;
      const isCurrent = () =>
        generation === userGenerationRef.current && seq === pageReqRef.current;

      setIsLoadingMore(true);

      try {
        const page = await fetchNotifications({ limit: PAGE_SIZE, cursor });
        if (!isCurrent()) return;

        setNotifications((prev) => mergeNotifications(prev, page.rows));
        // Only advance the cursor on success — a failed page stays retryable at
        // exactly the same boundary.
        if (page.nextCursor) cursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
        setPageError(null);
      } catch (e) {
        if (!isCurrent()) return;
        // An invalid cursor must NOT fall back to an uncursored fetch (that
        // would silently refetch page 1) and must NOT set hasMore=false (that
        // would claim "all caught up" when it isn't).
        setPageError(e instanceof InvalidCursorError ? 'invalid-cursor' : 'network');
      } finally {
        // Release ONLY the ownership this request still holds. A reset or a
        // recovery pass revokes the token, and an obsolete request must not
        // unlock the lane for whoever owns it now.
        if (pageOwnerRef.current === seq) pageOwnerRef.current = null;
        if (isCurrent()) setIsLoadingMore(false);
      }
    },
    [user, isLoading, isOnline, hasMore, isLoadingMore, pageError]
  );

  /**
   * Recovers pagination after the cursor turns out to be structurally invalid.
   *
   * Retrying the same malformed cursor can never succeed, so the Reload button
   * routes here instead of to loadMore. Two ordered attempts:
   *
   *   Step A — a cursor re-derived from the oldest loaded row, but ONLY if it is
   *            structurally valid and actually different from the failed one.
   *   Step B — an uncursored page-one fetch that replaces the list.
   *
   * Branch selection is structural, never failure-driven: a transient network
   * error while requesting a valid candidate does not prove the candidate is
   * unusable, so it must not escalate to a full reset in the same attempt.
   *
   * Rows stay on screen the entire time — the list is only ever replaced after a
   * replacement page has actually arrived.
   */
  const recoverPagination = useCallback(async () => {
    if (!user || isLoading || !isOnline) return;
    if (isRecoveringRef.current) return;
    // Read mutations own rows optimistically; replacing the list underneath them
    // would leave their rollback pointing at rows that no longer exist.
    if (markAllPendingRef.current) return;
    if (pendingReadIdsRef.current.size > 0) return;

    const generation = userGenerationRef.current;

    // Invalidate every in-flight page request from the broken boundary, and take
    // the page lane for this recovery pass.
    pageReqRef.current += 1;
    const seq = pageReqRef.current;
    pageOwnerRef.current = seq;
    const isCurrent = () =>
      generation === userGenerationRef.current && seq === pageReqRef.current;

    isRecoveringRef.current = true;
    setIsRecovering(true);

    const failedCursor = cursorRef.current;
    const oldest = notificationsRef.current[notificationsRef.current.length - 1];
    // Held locally: the shared cursorRef is never written with an unproven value.
    const candidate: NotificationCursor | null = oldest
      ? { created_at: oldest.created_at, id: oldest.id }
      : null;

    const candidateIsUsable =
      candidate !== null &&
      isValidCursor(candidate) &&
      !(
        failedCursor !== null &&
        candidate.created_at === failedCursor.created_at &&
        candidate.id === failedCursor.id
      );

    let recovered = false;

    try {
      // --- Step A: repaired cursor --------------------------------------------
      if (candidateIsUsable) {
        try {
          const page = await fetchNotifications({ limit: PAGE_SIZE, cursor: candidate });
          if (!isCurrent()) return;

          setNotifications((prev) => mergeNotifications(prev, page.rows));
          // The server's next boundary, not the candidate we sent.
          cursorRef.current = page.nextCursor;
          setHasMore(page.hasMore);
          setPageError(null);
          recovered = true;
        } catch (e) {
          if (!isCurrent()) return;
          if (!(e instanceof InvalidCursorError)) {
            // Transient. Keep the rows and stay on the Reload path so the next
            // attempt retries Step A rather than escalating to a hard reset.
            toast({
              description: "Couldn't reach the server. Try again.",
              variant: 'destructive',
            });
            return;
          }
          // The re-derived cursor is structurally rejected too — fall to Step B.
        }
      }

      // --- Step B: hard reset to page one -------------------------------------
      if (!recovered) {
        try {
          const page = await fetchNotifications({ limit: PAGE_SIZE });
          if (!isCurrent()) return;

          // Replace, never merge: the old rows belong to a pagination history
          // that the broken cursor makes unreconstructable.
          setNotifications(page.rows);
          cursorRef.current = page.nextCursor;
          setHasMore(page.hasMore);
          setPageError(null);
          recovered = true;
        } catch {
          if (!isCurrent()) return;
          // Keep the rows and keep 'invalid-cursor' even for a network failure,
          // so the UI stays on Reload and never offers a same-cursor Retry.
          setPageError('invalid-cursor');
          toast({
            description: "Couldn't reload notifications. Try again.",
            variant: 'destructive',
          });
        }
      }
    } finally {
      if (pageOwnerRef.current === seq) pageOwnerRef.current = null;
      isRecoveringRef.current = false;
      setIsRecovering(false);
    }

    // Release-before-reconcile: the count lane only runs once recovery has given
    // up ownership. Deliberately NOT refreshHead() — Step B already fetched the
    // head, and the two lanes are kept separate on purpose.
    if (recovered && generation === userGenerationRef.current) {
      void refreshUnreadCount();
    }
  }, [user, isLoading, isOnline, refreshUnreadCount]);


  // Drain a count refetch that was dropped by the commit gate, once every
  // mutation has settled.
  useEffect(() => {
    if (pendingReadOps === 0 && !markAllPending && countRefetchQueuedRef.current) {
      countRefetchQueuedRef.current = false;
      void refreshUnreadCount();
    }
  }, [pendingReadOps, markAllPending, refreshUnreadCount]);

  // Get unread notifications as a computed property
  const unreadNotifications = notifications.filter((n) => !n.is_read);
  // Scoped to loaded pages. Distinct from the server-authoritative `unreadCount`.
  const loadedUnreadCount = unreadNotifications.length;

  useEffect(() => {
    // Only set up polling if user is authenticated and not loading
    if (!user || isLoading) return;

    fetchAll();

    // Self-rescheduling setTimeout pattern (per background-timer-policy)
    // Respects network state — skips fetch when offline
    const scheduleNext = () => {
      timerRef.current = setTimeout(async () => {
        if (document.hidden) {
          scheduleNext();
          return;
        }
        await fetchAll();
        scheduleNext();
      }, pollInterval);
    };

    scheduleNext();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user, isLoading, fetchAll, pollInterval]);

  return {
    notifications,
    unreadNotifications,
    unreadCount,
    countStatus,
    loadedUnreadCount,
    markAsRead,
    markAllAsRead,
    markAllPending,
    hasMore,
    isLoadingMore,
    pageError,
    loadMore,
    // `loading` now means "first load, nothing to show yet" — background polls
    // never flip it, so existing rows are never replaced by loading UI.
    loading: isInitialLoad,
    isInitialLoad,
    isRefreshing,
    markingAsRead: pendingReadOps > 0,
    // Fetch-only. Mutation failures surface via toast, pagination via pageError.
    fetchError,
    lastRefresh,
    isOnline,
    fetchAll
  };
}
