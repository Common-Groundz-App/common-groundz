
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchNotifications, markNotificationsAsRead, Notification } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkStatusService } from '@/services/networkStatusService';

/**
 * Public return shape of the hook. Exported so the notifications provider can
 * derive its context contract from it without duplicating types.
 */
export interface UseNotificationsResult {
  notifications: Notification[];
  unreadNotifications: Notification[];
  unreadCount: number;
  markAsRead: (ids: string[]) => Promise<void>;
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
  // Fetch-only error channel. Mutation failures never write here — they roll
  // back per-id and surface a toast — so the drawer's refresh UI can't be
  // triggered by a failed mark-as-read.
  const [fetchError, setFetchError] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether a fetch has ever succeeded for the current user.
  // Kept in a ref (not state) so it never enters fetchAll's dependency list —
  // otherwise every response would recreate fetchAll and restart the poller.
  const hasLoadedRef = useRef<boolean>(false);
  // Bumped whenever the authenticated user changes. Captured by both fetches
  // and mutations so work belonging to a previous session commits nothing.
  const userGenerationRef = useRef<number>(0);
  // Incremented per fetch; only the newest response for the current user may
  // commit, so an older poll can't overwrite a newer manual retry.
  const requestSeqRef = useRef<number>(0);
  // Notification ids currently owned by an in-flight mark-as-read mutation.
  // Guarantees exactly one mutation owns a row, so a failed rollback can never
  // contradict a concurrent success on the same row.
  const pendingReadIdsRef = useRef<Set<string>>(new Set());

  // Reset all per-user state when the authenticated user changes, so a previous
  // session's rows/errors/mutations can never leak into the next one.
  useEffect(() => {
    userGenerationRef.current += 1;
    requestSeqRef.current += 1;
    hasLoadedRef.current = false;
    pendingReadIdsRef.current.clear();
    setPendingReadOps(0);
    setNotifications([]);
    setFetchError(null);
    setLastRefresh(null);
    setIsRefreshing(false);
    setIsInitialLoad(false);
  }, [user?.id]);

  const fetchAll = useCallback(async () => {
    // Don't fetch if user is not authenticated, still loading, or offline
    if (!user || isLoading || !isOnline) return;

    const generation = userGenerationRef.current;
    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    // A response may only touch state (or app-wide network health) if it is
    // still the newest request for the still-current user.
    const isCurrent = () =>
      generation === userGenerationRef.current && seq === requestSeqRef.current;

    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoad(true);
    }

    try {
      const data = await fetchNotifications();
      if (!isCurrent()) return;

      // Monotonic reconciliation: a fetch must never turn a locally-read row
      // back to unread. A poll started before an optimistic read can return a
      // stale snapshot, and the pending id may already have been released by
      // the time it lands. This rule is valid ONLY because the app has no
      // mark-as-unread action — if that changes, replace it with row
      // versioning/timestamps instead.
      setNotifications((prev) => {
        const locallyRead = new Set<string>(pendingReadIdsRef.current);
        prev.forEach((row) => {
          if (row.is_read) locallyRead.add(row.id);
        });
        return data.map((row) =>
          !row.is_read && locallyRead.has(row.id) ? { ...row, is_read: true } : row
        );
      });

      setLastRefresh(new Date());
      hasLoadedRef.current = true;
      // Clear any previous failure so a recovered fetch doesn't leave a stale error UI
      setFetchError(null);
      networkStatusService.reportSuccess();
    } catch (e) {
      if (!isCurrent()) return;
      setFetchError(e);
      networkStatusService.reportFailure(e);
      // Background fetch — fail silently (no toast)
    } finally {
      // Only the newest applicable request owns the loading flags.
      if (isCurrent()) {
        setIsInitialLoad(false);
        setIsRefreshing(false);
      }
    }
  }, [user, isLoading, isOnline]);

  const markAsRead = async (ids: string[]) => {
    if (!user || !ids.length || isLoading) return;

    const generation = userGenerationRef.current;

    // Eligibility: only rows that are actually unread locally and not already
    // owned by another in-flight mutation. Capture each row's exact prior
    // is_read value so a rollback restores reality, not an assumption.
    const priorReadState = new Map<string, boolean>();
    const eligibleIds: string[] = [];

    setNotifications((prev) => {
      const requested = new Set(ids);
      prev.forEach((row) => {
        if (!requested.has(row.id)) return;
        if (row.is_read) return;
        if (pendingReadIdsRef.current.has(row.id)) return;
        priorReadState.set(row.id, row.is_read);
        eligibleIds.push(row.id);
      });

      if (eligibleIds.length === 0) return prev;

      const owned = new Set(eligibleIds);
      return prev.map((row) => (owned.has(row.id) ? { ...row, is_read: true } : row));
    });

    // Nothing to do — don't take ownership and don't move the spinner.
    if (eligibleIds.length === 0) return;

    eligibleIds.forEach((id) => pendingReadIdsRef.current.add(id));
    setPendingReadOps((n) => n + 1);

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
      }
    }
  };

  // Get unread notifications as a computed property
  const unreadNotifications = notifications.filter((n) => !n.is_read);

  // NOTE: loaded-page scoped. fetchNotifications() caps at 20 rows, so this is
  // the unread count of what's loaded — not the user's global unread total.
  // A true global count is Phase 2 (needs a server-side count query).
  const unreadCount = unreadNotifications.length;

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
    markAsRead,
    // `loading` now means "first load, nothing to show yet" — background polls
    // never flip it, so existing rows are never replaced by loading UI.
    loading: isInitialLoad,
    isInitialLoad,
    isRefreshing,
    markingAsRead: pendingReadOps > 0,
    // Fetch-only. Mutation failures surface via toast, not here.
    fetchError,
    lastRefresh,
    isOnline,
    fetchAll
  };
}
