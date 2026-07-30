import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNotifications,
  isValidCursor,
  InvalidCursorError,
  type Notification,
  type NotificationCursor,
  type NotificationPage,
  type PageError,
} from '@/services/notificationService';
import { toast } from '@/hooks/use-toast';

/**
 * Shared request mechanics for one notifications data lane.
 *
 * A "lane" is one server query shape with its own cursor, its own request
 * ownership and its own error state. The app runs two:
 *
 *   All lane    — every notification. Rows STAY after being read.
 *   Unread lane — `is_read = false` only. Rows LEAVE the dataset once read.
 *
 * That difference is why reconciliation is injected rather than shared: the All
 * lane merges and preserves accumulated pages, while the Unread lane treats a
 * head page as authoritative over its own window. This hook owns only the
 * plumbing — sequencing, ownership tokens, cursor advancement, recovery.
 *
 * Nothing outside this hook may call `setRows`; mutations go through the
 * controlled writers (`patchRowsById` / `dropRowsById` / `replaceRows`) so the
 * rows ref and the state can never drift apart.
 */

export interface LaneReconcilers {
  /** Applied to a head-refresh response. */
  head: (prev: Notification[], page: NotificationPage) => Notification[];
  /** Applied to a `loadMore` / recovery page response. */
  append: (prev: Notification[], page: NotificationPage) => Notification[];
}

export interface UseNotificationLaneOptions {
  unreadOnly: boolean;
  pageSize: number;
  /** Signed in, auth settled, online. */
  enabled: boolean;
  /** Bumped on auth change; captured by every request. */
  generationRef: React.MutableRefObject<number>;
  /** True while any read mutation owns rows app-wide. */
  isMutationHeld: () => boolean;
  reconcilers: LaneReconcilers;
  /**
   * Runs after a head response has been committed, still under the head
   * request's sequence token. The Unread lane uses this for membership
   * revalidation of rows older than the head window.
   */
  onHeadCommitted?: (page: NotificationPage, isCurrent: () => boolean) => void;
}

export interface NotificationLane {
  rows: Notification[];
  rowsRef: React.MutableRefObject<Notification[]>;
  hasMore: boolean;
  isLoadingMore: boolean;
  pageError: PageError;
  /** Lane-scoped fetch failure. Deliberately NOT global: an All-lane failure
   *  must not blank a healthy Unread tab, and vice versa. */
  fetchError: unknown;
  isInitialLoad: boolean;
  isRefreshing: boolean;
  isRecovering: boolean;
  hasLoadedRef: React.MutableRefObject<boolean>;
  lastRefresh: Date | null;
  refreshHead: () => Promise<void>;
  loadMore: (opts?: { force?: boolean }) => Promise<void>;
  recoverPagination: () => Promise<boolean>;
  reset: () => void;
  patchRowsById: (ids: Set<string>, patch: (row: Notification) => Notification) => void;
  dropRowsById: (ids: Set<string>) => void;
  replaceRows: (rows: Notification[]) => void;
}

export function useNotificationLane({
  unreadOnly,
  pageSize,
  enabled,
  generationRef,
  isMutationHeld,
  reconcilers,
  onHeadCommitted,
}: UseNotificationLaneOptions): NotificationLane {
  const [rows, setRows] = useState<Notification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<PageError>(null);
  const [fetchError, setFetchError] = useState<unknown>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Read-only mirror, so eligibility and rollback data can be derived BEFORE
  // any setter runs. React may invoke a functional updater more than once.
  const rowsRef = useRef<Notification[]>([]);
  const hasLoadedRef = useRef(false);
  const serverCursorRef = useRef<NotificationCursor | null>(null);
  const headSeqRef = useRef(0);
  const pageSeqRef = useRef(0);
  // Synchronous lane ownership token. `isLoadingMore` is state and does not
  // settle within a tick, so two same-tick callers would both fire. A TOKEN, not
  // a boolean: an obsolete request whose ownership was revoked must never
  // release a lock a newer request has since taken.
  const pageOwnerRef = useRef<number | null>(null);
  const isRecoveringRef = useRef(false);

  // Keep the latest injected callbacks reachable without putting them in the
  // dependency lists below (which would restart the poller on every render).
  const reconcilersRef = useRef(reconcilers);
  reconcilersRef.current = reconcilers;
  const onHeadCommittedRef = useRef(onHeadCommitted);
  onHeadCommittedRef.current = onHeadCommitted;
  const isMutationHeldRef = useRef(isMutationHeld);
  isMutationHeldRef.current = isMutationHeld;

  const commitRows = useCallback((next: Notification[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  const patchRowsById = useCallback(
    (ids: Set<string>, patch: (row: Notification) => Notification) => {
      if (ids.size === 0) return;
      commitRows(rowsRef.current.map((row) => (ids.has(row.id) ? patch(row) : row)));
    },
    [commitRows]
  );

  const dropRowsById = useCallback(
    (ids: Set<string>) => {
      if (ids.size === 0) return;
      commitRows(rowsRef.current.filter((row) => !ids.has(row.id)));
    },
    [commitRows]
  );

  const replaceRows = useCallback(
    (next: Notification[]) => commitRows(next),
    [commitRows]
  );

  const reset = useCallback(() => {
    headSeqRef.current += 1;
    pageSeqRef.current += 1;
    // Revoke ownership outright — in-flight requests can no longer release it.
    pageOwnerRef.current = null;
    isRecoveringRef.current = false;
    hasLoadedRef.current = false;
    serverCursorRef.current = null;
    rowsRef.current = [];
    setRows([]);
    setHasMore(false);
    setIsLoadingMore(false);
    setPageError(null);
    setFetchError(null);
    setIsInitialLoad(false);
    setIsRefreshing(false);
    setIsRecovering(false);
    setLastRefresh(null);
  }, []);

  const refreshHead = useCallback(async () => {
    if (!enabled) return;

    const generation = generationRef.current;
    headSeqRef.current += 1;
    const seq = headSeqRef.current;
    const isCurrent = () =>
      generation === generationRef.current && seq === headSeqRef.current;

    if (hasLoadedRef.current) setIsRefreshing(true);
    else setIsInitialLoad(true);

    try {
      const page = await fetchNotifications({ limit: pageSize, unreadOnly });
      if (!isCurrent()) return;

      const isFirstLoad = !hasLoadedRef.current;
      commitRows(reconcilersRef.current.head(rowsRef.current, page));

      // Only the first load establishes the cursor and hasMore — later head
      // refreshes must never rewind pagination to page one.
      if (isFirstLoad) {
        serverCursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
      }

      hasLoadedRef.current = true;
      setLastRefresh(new Date());
      setFetchError(null);

      onHeadCommittedRef.current?.(page, isCurrent);
    } catch (e) {
      if (!isCurrent()) return;
      // Includes an unsortable server timestamp: it fails the REQUEST here,
      // before any state commit, instead of throwing later inside React.
      setFetchError(e);
    } finally {
      if (isCurrent()) {
        setIsInitialLoad(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled, pageSize, unreadOnly, generationRef, commitRows]);

  /**
   * `force` exists because the guard below refuses to run while `pageError` is
   * set. The IntersectionObserver always calls the UNFORCED variant so it can
   * never retry-loop; only the explicit button forces.
   */
  const loadMore = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;

      if (!enabled) return;
      if (!hasMore) return;
      if (pageOwnerRef.current !== null) return;
      if (isRecoveringRef.current) return;
      if (isMutationHeldRef.current()) return;
      if (pageError && !force) return;

      const cursor = serverCursorRef.current;
      if (!cursor) {
        setHasMore(false);
        return;
      }

      if (force) setPageError(null);

      const generation = generationRef.current;
      pageSeqRef.current += 1;
      const seq = pageSeqRef.current;
      pageOwnerRef.current = seq;
      const isCurrent = () =>
        generation === generationRef.current && seq === pageSeqRef.current;

      setIsLoadingMore(true);

      try {
        const page = await fetchNotifications({ limit: pageSize, cursor, unreadOnly });
        if (!isCurrent()) return;

        commitRows(reconcilersRef.current.append(rowsRef.current, page));
        // Advance only on success — a failed page stays retryable at exactly
        // the same boundary.
        if (page.nextCursor) serverCursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
        setPageError(null);
      } catch (e) {
        if (!isCurrent()) return;
        // An invalid cursor must NOT fall back to an uncursored fetch (silent
        // page-one refetch) and must NOT set hasMore=false ("all caught up"
        // when it isn't).
        setPageError(e instanceof InvalidCursorError ? 'invalid-cursor' : 'network');
      } finally {
        if (pageOwnerRef.current === seq) pageOwnerRef.current = null;
        if (isCurrent()) setIsLoadingMore(false);
      }
    },
    [enabled, hasMore, pageError, pageSize, unreadOnly, generationRef, commitRows]
  );

  /**
   * Recovery for a structurally invalid cursor. Retrying the same malformed
   * cursor can never succeed, so this is a distinct path from Retry.
   *
   *   Step A — a cursor re-derived from the oldest loaded row, but ONLY if it is
   *            structurally valid AND different from the one that failed.
   *   Step B — an uncursored page-one fetch that replaces the list.
   *
   * Branch selection is STRUCTURAL, never failure-driven: a network error while
   * requesting a valid candidate does not prove the candidate is unusable, so it
   * must not escalate to a hard reset in the same attempt.
   *
   * Rows stay on screen throughout — the list is only replaced once a
   * replacement page has actually arrived.
   */
  const recoverPagination = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    if (isRecoveringRef.current) return false;
    if (isMutationHeldRef.current()) return false;

    const generation = generationRef.current;
    pageSeqRef.current += 1;
    const seq = pageSeqRef.current;
    pageOwnerRef.current = seq;
    const isCurrent = () =>
      generation === generationRef.current && seq === pageSeqRef.current;

    isRecoveringRef.current = true;
    setIsRecovering(true);

    const failedCursor = serverCursorRef.current;
    const oldest = rowsRef.current[rowsRef.current.length - 1];
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
      if (candidateIsUsable) {
        try {
          const page = await fetchNotifications({
            limit: pageSize,
            cursor: candidate,
            unreadOnly,
          });
          if (!isCurrent()) return false;

          commitRows(reconcilersRef.current.append(rowsRef.current, page));
          // The server's next boundary, not the candidate we sent.
          serverCursorRef.current = page.nextCursor;
          setHasMore(page.hasMore);
          setPageError(null);
          recovered = true;
        } catch (e) {
          if (!isCurrent()) return false;
          if (!(e instanceof InvalidCursorError)) {
            toast({
              description: "Couldn't reach the server. Try again.",
              variant: 'destructive',
            });
            return false;
          }
          // Re-derived cursor structurally rejected too — fall through to B.
        }
      }

      if (!recovered) {
        try {
          const page = await fetchNotifications({ limit: pageSize, unreadOnly });
          if (!isCurrent()) return false;

          // Replace, never merge: the old rows belong to a pagination history
          // the broken cursor makes unreconstructable.
          commitRows(page.rows);
          serverCursorRef.current = page.nextCursor;
          setHasMore(page.hasMore);
          setPageError(null);
          recovered = true;
        } catch {
          if (!isCurrent()) return false;
          // Keep 'invalid-cursor' even for a network failure, so the UI stays on
          // Reload and never offers a same-cursor Retry.
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

    return recovered && generation === generationRef.current;
  }, [enabled, pageSize, unreadOnly, generationRef, commitRows]);

  // Keep the mirror aligned if rows are ever set through a code path that
  // bypassed commitRows (defensive; nothing should).
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  return {
    rows,
    rowsRef,
    hasMore,
    isLoadingMore,
    pageError,
    fetchError,
    isInitialLoad,
    isRefreshing,
    isRecovering,
    hasLoadedRef,
    lastRefresh,
    refreshHead,
    loadMore,
    recoverPagination,
    reset,
    patchRowsById,
    dropRowsById,
    replaceRows,
  };
}
