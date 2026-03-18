
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
  const [loading, setLoading] = useState<boolean>(false);
  const [markingAsRead, setMarkingAsRead] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    // Don't fetch if user is not authenticated, still loading, or offline
    if (!user || isLoading || !isOnline) return;
    
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
      setLastRefresh(new Date());
      networkStatusService.reportSuccess();
    } catch (e) {
      setError(e);
      networkStatusService.reportFailure(e);
      // Background fetch — fail silently (no toast)
    } finally {
      setLoading(false);
    }
  }, [user, isLoading, isOnline]);

  const markAsRead = async (ids: string[]) => {
    if (!user || !ids.length || isLoading) return;
    setMarkingAsRead(true);
    try {
      await markNotificationsAsRead(ids);
      setNotifications((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, is_read: true } : item
        )
      );
    } catch (e) {
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
    loading, 
    markingAsRead,
    error, 
    fetchAll 
  };
}
