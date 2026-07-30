import React, { useState } from 'react';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
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

/**
 * The single app-wide notifications drawer. Rendered exactly once by App inside
 * NotificationsProvider — open state and data both come from the context, so
 * every trigger in the app opens this same instance.
 */
export function NotificationDrawer() {
  const {
    notifications,
    unreadNotifications,
    all,
    unread,
    unreadCount,
    countStatus,
    loadedUnreadCount,
    markAsRead,
    markAllAsRead,
    markAllPending,
    historyStale,
    isRevalidating,
    refreshUnreadHistory,
    setUnreadLaneActive,
    isRecovering,
    loading,
    isUnreadInitialLoad,
    markingAsRead,
    lastRefresh,
    isOnline,
    isRefreshing,
    fetchAll,
    isNotificationsOpen,
    closeNotifications,
    setNotificationsOpen,
  } = useNotificationsContext();
  const { openContent } = useContentViewer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  // The Unread lane only fetches/polls while the drawer is open AND the tab is
  // selected. The provider handles deactivation on close.
  React.useEffect(() => {
    setUnreadLaneActive(isNotificationsOpen && activeTab === 'unread');
  }, [isNotificationsOpen, activeTab, setUnreadLaneActive]);


  const handleNotificationClick = React.useCallback((notification: Notification, event: React.MouseEvent) => {
    event.preventDefault();

    // Fire-and-forget: the hook applies the read state optimistically (with
    // rollback on failure), so navigation must never wait on the network.
    if (!notification.is_read) {
      void markAsRead([notification.id]);
    }

    closeNotifications();
    
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
  }, [navigate, openContent, toast, closeNotifications, markAsRead]);

  // Both derive from the fetch-only error channel, so a failed mark-as-read
  // can never render refresh failure UI.
  const hasError = Boolean(fetchError) && notifications.length === 0;
  const hasStaleData = Boolean(fetchError) && notifications.length > 0;

  // Server-side mark-all clears EVERY unread row, including ones older than the
  // pages loaded — hence the global-count arm. `markingAsRead` is included
  // because the hook refuses to start mark-all while an individual read is in
  // flight; offering a button that can only reply with a toast is worse than
  // disabling it.
  const canMarkAll =
    !markAllPending &&
    !markingAsRead &&
    !isRecovering &&
    (loadedUnreadCount > 0 || (unreadCount ?? 0) > 0);
  const showMarkAll = markAllPending || loadedUnreadCount > 0 || (unreadCount ?? 0) > 0;

  // The mismatch notice is only honest when the count is fully authoritative:
  // pagination exhausted, count ready (not loading/error/stale), and no mutation
  // or pagination recovery in flight holding the count or the list mid-change.
  const showCountMismatch =
    !hasMore &&
    countStatus === 'ready' &&
    unreadCount !== null &&
    !markAllPending &&
    !markingAsRead &&
    !isRecovering &&
    notifications.length > 0 &&
    unreadCount > loadedUnreadCount;

  // Unread tab: zero unread loaded doesn't mean zero unread exist.
  const unloadedUnreadMessage =
    loadedUnreadCount === 0 && (unreadCount ?? 0) > 0
      ? `You have ${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'} in total. Load more to find older unread ones.`
      : null;


  return (
    <Sheet open={isNotificationsOpen} onOpenChange={setNotificationsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="shrink-0 space-y-0 bg-background/95 backdrop-blur-lg border-b border-border/50 p-4 pr-12">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-sm font-semibold">Notifications</SheetTitle>
            </div>
            <SheetDescription className="sr-only">View and manage your notifications</SheetDescription>
            <div className="flex min-h-[28px] items-center justify-between gap-2">
              {lastRefresh ? <LastUpdatedIndicator date={lastRefresh} /> : <span />}
              {showMarkAll && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void markAllAsRead()}
                  disabled={!canMarkAll}
                >
                  {markAllPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Mark all as read
                </Button>
              )}
            </div>
          </SheetHeader>

          {!isOnline ? (
            <div className="shrink-0 px-4 pt-2">
              <OfflineInlineState
                message={notifications.length > 0 ? "Showing recent notifications" : "Can't load notifications while offline"}
                onRetry={notifications.length === 0 ? fetchAll : undefined}
                lastRefresh={lastRefresh}
              />
            </div>
          ) : hasStaleData ? (
            // Online server failure with cached rows: keep the rows, surface a
            // compact non-blocking retry (distinct from the offline banner).
            <div className="shrink-0 px-4 pt-2">
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Couldn't refresh</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={fetchAll}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

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
                  {/* Global count, not the loaded-page count — hidden entirely
                      while the count is still unknown. */}
                  Unread {unreadCount !== null && unreadCount > 0 && `(${unreadCount})`}
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
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                pageError={pageError}
                onLoadMore={loadMore}
                onRecoverPagination={recoverPagination}
                isRecovering={isRecovering}
                showCountMismatch={showCountMismatch}
              />
            </TabsContent>

            <TabsContent
              value="unread"
              className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
            >
              {/* Pagination is shared with the All tab for now: loading more
                  pulls in older rows of both kinds. Independent unread paging is
                  Phase 2.2 — until then the copy stays honest about it. */}
              <NotificationList
                notifications={unreadNotifications}
                loading={loading}
                hasError={hasError}
                onRetry={fetchAll}
                onNotificationClick={handleNotificationClick}
                emptyMessage="No unread notifications"
                emptyIcon={Check}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                pageError={pageError}
                onLoadMore={loadMore}
                onRecoverPagination={recoverPagination}
                isRecovering={isRecovering}
                unloadedUnreadMessage={unloadedUnreadMessage}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
