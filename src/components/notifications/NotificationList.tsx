
import React from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Notification } from "@/services/notificationService";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onNotificationClick: (notification: Notification, event: React.MouseEvent) => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
}

export function NotificationList({ 
  notifications, 
  loading, 
  onNotificationClick,
  emptyMessage = "No notifications yet",
  emptyIcon: EmptyIcon = Bell 
}: NotificationListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <EmptyIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-1">
      {notifications.map((notification) => (
        <button
          key={notification.id}
          onClick={(e) => onNotificationClick(notification, e)}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200",
            "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            !notification.is_read && "bg-primary/5"
          )}
        >
          <div className="flex items-start gap-3">
            <UserAvatar
              imageUrl={notification.image_url}
              username={notification.title}
              className="w-9 h-9"
            />
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm leading-5 text-foreground",
                !notification.is_read && "font-medium"
              )}>
                {notification.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                {notification.message}
              </p>
              <p className="text-[11px] text-muted-foreground/75 mt-1">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
            {notification.is_read && (
              <Check className="w-4 h-4 text-primary/50 mt-1 shrink-0" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
