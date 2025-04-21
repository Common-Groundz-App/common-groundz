
import { useState, useEffect, useCallback } from 'react';
import { fetchNotifications, markNotificationsAsRead, Notification } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications(pollInterval = 10000) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = async (ids: string[]) => {
    if (!user || !ids.length) return;
    try {
      await markNotificationsAsRead(ids);
      setNotifications((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, is_read: true } : item
        )
      );
    } catch (e) {
      setError(e);
    }
  };

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const interval = setInterval(fetchAll, pollInterval);
    return () => clearInterval(interval);
  }, [user, fetchAll, pollInterval]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, markAsRead, loading, error, fetchAll };
}
