
import { useState, useEffect, useCallback } from 'react';
import { fetchNotifications, markNotificationsAsRead, Notification } from '@/services/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useNotifications(pollInterval = 10000) {
  const { user, isLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [markingAsRead, setMarkingAsRead] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    // Don't fetch if user is not authenticated or still loading
    if (!user || isLoading) return;
    
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (e) {
      setError(e);
      toast({
        title: "Error fetching notifications",
        description: "Failed to load your notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, isLoading]);

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
    const interval = setInterval(fetchAll, pollInterval);
    return () => clearInterval(interval);
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
