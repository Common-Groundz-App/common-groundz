import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Notifications trigger. Renders no drawer of its own — it opens the single
 * app-wide drawer owned by NotificationsProvider.
 */
export const NotificationBell: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { unreadCount, openNotifications } = useNotificationsContext();

  // Don't render if user is not authenticated or still loading
  if (isLoading || !user) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      className="relative h-8 w-8 rounded-full"
      onClick={openNotifications}
      // Deliberately no aria-live: polling + optimistic updates would make it noisy.
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white"
        >
          {unreadCount}
        </span>
      )}
    </Button>
  );
};

export default NotificationBell;
