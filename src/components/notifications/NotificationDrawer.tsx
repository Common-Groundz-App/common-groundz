import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { OfflineInlineState } from '@/components/ui/OfflineInlineState';
import { LastUpdatedIndicator } from '@/components/ui/LastUpdatedIndicator';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EntityType, Notification } from '@/services/notificationService';
import { NotificationList } from './NotificationList';

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const { notifications, unreadNotifications, unreadCount, markAsRead, loading, markingAsRead, lastRefresh, isOnline, isRefreshing, fetchError, fetchAll } = useNotifications();
  const { openContent } = useContentViewer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const handleNotificationClick = React.useCallback((notification: Notification, event: React.MouseEvent) => {
    event.preventDefault();

    // Fire-and-forget: the hook applies the read state optimistically (with
    // rollback on failure), so navigation must never wait on the network.
    if (!notification.is_read) {
      void markAsRead([notification.id]);
    }

    onOpenChange(false);
    
    if (!notification.entity_type || !notification.entity_id) {
      if (notification.action_url) {
        navigate(notification.action_url);
      } else {
        toast({
          description: "This notification doesn't have any associated content"
        });
      }
      return;
    }
    
    const commentId = notification.metadata?.comment_id || null;
    
    switch (notification.entity_type as EntityType) {
      case 'post':
        openContent('post', notification.entity_id, commentId);
        break;
      case 'recommendation':
        openContent('recommendation', notification.entity_id, commentId);
        break;
      case 'profile':
        // entity_id here is the user ID; action_url may contain username info
        // Fall back to /profile/:id which will redirect to /u/:username
        navigate(`/profile/${notification.entity_id}`);
        break;
      default:
        if (notification.action_url) {
          navigate(notification.action_url);
        } else {
          toast({
            description: "This notification doesn't have any associated content"
          });
        }
    }
  }, [navigate, openContent, toast, onOpenChange, markAsRead]);

  const handleMarkAllAsRead = () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  // Only surface the error state when there is nothing cached to show at all
  const hasError = Boolean(error) && notifications.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="shrink-0 space-y-0 bg-background/95 backdrop-blur-lg border-b border-border/50 p-4 pr-12">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-sm font-semibold">Notifications</SheetTitle>
            </div>
            <SheetDescription className="sr-only">View and manage your notifications</SheetDescription>
            <div className="flex min-h-[28px] items-center justify-between gap-2">
              {lastRefresh ? <LastUpdatedIndicator date={lastRefresh} /> : <span />}
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleMarkAllAsRead}
                  disabled={markingAsRead}
                >
                  {markingAsRead ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Mark all as read
                </Button>
              )}
            </div>
          </SheetHeader>

          {!isOnline && (
            <div className="shrink-0 px-4 pt-2">
              <OfflineInlineState
                message={notifications.length > 0 ? "Showing recent notifications" : "Can't load notifications while offline"}
                onRetry={notifications.length === 0 ? fetchAll : undefined}
                lastRefresh={lastRefresh}
              />
            </div>
          )}

          <Tabs
            defaultValue={activeTab}
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 px-4 pt-2">
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                <TabsTrigger value="unread" className="flex-1">
                  Unread {unreadCount > 0 && `(${unreadCount})`}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="all"
              className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
            >
              <NotificationList
                notifications={notifications}
                loading={loading}
                hasError={hasError}
                onRetry={fetchAll}
                onNotificationClick={handleNotificationClick}
              />
            </TabsContent>

            <TabsContent
              value="unread"
              className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
            >
              <NotificationList
                notifications={unreadNotifications}
                loading={loading}
                hasError={hasError}
                onRetry={fetchAll}
                onNotificationClick={handleNotificationClick}
                emptyMessage="No unread notifications"
                emptyIcon={Check}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
