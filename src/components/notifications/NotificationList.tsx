
import React from 'react';
import { Bell, Check, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileAvatar } from "@/components/common/ProfileAvatar";
import { Notification } from "@/services/notificationService";
import { formatNotificationTime } from "@/utils/dateUtils";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onNotificationClick: (notification: Notification, event: React.MouseEvent) => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  hasError?: boolean;
  onRetry?: () => void;
}

function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 py-0.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

export function NotificationList({ 
  notifications, 
  loading, 
  onNotificationClick,
  emptyMessage = "No notifications yet",
  emptyIcon: EmptyIcon = Bell,
  hasError = false,
  onRetry
}: NotificationListProps) {
  // Initial load only — background polling never renders skeletons over existing rows
  if (loading && notifications.length === 0) {
    return (
      <div className="px-2 py-1">
        {[0, 1, 2, 3].map((i) => (
          <NotificationRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state is distinct from the empty state, and only shown when there is
  // nothing cached to display (otherwise we keep showing stale rows).
  if (hasError && notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Couldn't load notifications</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={onRetry}>
            Retry
          </Button>
        )}
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
      {notifications.map((notification) => {
        const timestamp = formatNotificationTime(notification.created_at);

        return (
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
              {notification.sender_id ? (
                <ProfileAvatar
                  userId={notification.sender_id}
                  size="sm"
                  className="h-9 w-9 shrink-0"
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  aria-hidden="true"
                >
                  <Bell className="h-4 w-4" />
                </div>
              )}
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
                {timestamp && (
                  <p className="text-[11px] text-muted-foreground/75 mt-1">
                    {timestamp}
                  </p>
                )}
              </div>
              {notification.is_read && (
                <Check className="w-4 h-4 text-primary/50 mt-1 shrink-0" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
