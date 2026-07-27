
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchNotifications, markNotificationsAsRead, Notification } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkStatusService } from '@/services/networkStatusService';

export function useNotifications(pollInterval = 10000) {
  const { user, isLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [markingAsRead, setMarkingAsRead] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether a fetch has ever succeeded for the current user.
  // Kept in a ref (not state) so it never enters fetchAll's dependency list —
  // otherwise every response would recreate fetchAll and restart the poller.
  const hasLoadedRef = useRef<boolean>(false);

  // Reset all per-user state when the authenticated user changes, so a previous
  // session's rows/errors can never leak into the next one.
  useEffect(() => {
    hasLoadedRef.current = false;
    setNotifications([]);
    setError(null);
    setLastRefresh(null);
    setIsRefreshing(false);
    setIsInitialLoad(false);
  }, [user?.id]);

  const fetchAll = useCallback(async () => {
    // Don't fetch if user is not authenticated, still loading, or offline
    if (!user || isLoading || !isOnline) return;

    if (hasLoadedRef.current) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoad(true);
    }

    try {
      const data = await fetchNotifications();
      setNotifications(data);
      setLastRefresh(new Date());
      hasLoadedRef.current = true;
      // Clear any previous failure so a recovered fetch doesn't leave a stale error UI
      setError(null);
      networkStatusService.reportSuccess();
    } catch (e) {
      setError(e);
      networkStatusService.reportFailure(e);
      // Background fetch — fail silently (no toast)
    } finally {
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  }, [user, isLoading, isOnline]);

  const markAsRead = async (ids: string[]) => {
    if (!user || !ids.length || isLoading) return;
    setMarkingAsRead(true);

    // Optimistic update with rollback: apply immediately so the row and the
    // unread count move without waiting for the network.
    let snapshot: Notification[] = [];
    setNotifications((prev) => {
      snapshot = prev;
      return prev.map((item) =>
        ids.includes(item.id) ? { ...item, is_read: true } : item
      );
    });

    try {
      await markNotificationsAsRead(ids);
    } catch (e) {
      setNotifications(snapshot);
      setError(e);
      // User-triggered action — toast is appropriate
      toast({
        title: "Error updating notifications",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      });
    } finally {
      setMarkingAsRead(false);
    }
  };

  // Get unread notifications as a computed property
  const unreadNotifications = notifications.filter((n) => !n.is_read);

  // Calculate the count of unread notifications
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
    markingAsRead,
    error,
    lastRefresh,
    isOnline,
    fetchAll
  };
}
