
import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { NotificationPopover } from './NotificationPopover';
import { useAuth } from '@/contexts/AuthContext';

export const NotificationBell: React.FC = () => {
  const { user, isLoading } = useAuth();
  
  // Don't initialize notifications hook if user is not authenticated
  const { unreadCount } = useNotifications();

  // Don't render if user is not authenticated or still loading
  if (isLoading || !user) {
    return null;
  }

  return (
    <NotificationPopover 
      trigger={
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      }
    />
  );
};

export default NotificationBell;
