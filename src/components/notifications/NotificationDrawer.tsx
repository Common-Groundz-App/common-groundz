import React, { useState } from 'react';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { OfflineInlineState } from '@/components/ui/OfflineInlineState';
import { LastUpdatedIndicator } from '@/components/ui/LastUpdatedIndicator';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { resolveNotificationDestination, destinationUnavailableMessage } from '@/utils/notificationDestination';
import type { NotificationGroup } from '@/utils/notificationGrouping';
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
    realtimeStatus,
    isNotificationsOpen,
    closeNotifications,
    setNotificationsOpen,
  } = useNotificationsContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  // The Unread lane only fetches/polls while the drawer is open AND the tab is
  // selected. The provider handles deactivation on close.
  React.useEffect(() => {
    setUnreadLaneActive(isNotificationsOpen && activeTab === 'unread');
  }, [isNotificationsOpen, activeTab, setUnreadLaneActive]);


  const handleNotificationClick = React.useCallback((group: NotificationGroup, event: React.MouseEvent) => {
    event.preventDefault();

    // Fire-and-forget: the hook applies the read state optimistically (with
    // rollback on failure), so navigation must never wait on the network.
    // Read state is independent of whether the target still exists.
    // A group marks EVERY unread child in one call — the visible row stands in
    // for all of its events, so leaving siblings unread would be a lie.
    if (group.unreadEventIds.length > 0) {
      void markAsRead(group.unreadEventIds);
    }

    closeNotifications();

    // Aggregated groups share one target by construction, so the
    // representative's destination is correct for the whole group.
    const destination = resolveNotificationDestination(group.representative);

    if (destination.kind === 'route') {
      navigate(destination.path);
      return;
    }

    toast({
      description: destinationUnavailableMessage(destination.reason),
    });
  }, [navigate, toast, closeNotifications, markAsRead]);



  // Both derive from the ALL lane's fetch-only error channel, so a failed
  // mark-as-read can never render refresh failure UI.
  const hasError = Boolean(all.fetchError) && notifications.length === 0;
  const hasStaleData = Boolean(all.fetchError) && notifications.length > 0;
  const unreadHasError = Boolean(unread.fetchError) && unreadNotifications.length === 0;

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

  // Mismatch is an UNREAD-lane statement: it compares the global count with the
  // unread rows actually loaded, so it is only honest once the UNREAD lane is
  // exhausted, its history is verified (not stale/revalidating), the count is
  // ready, and nothing is mid-mutation or mid-recovery.
  const showCountMismatch =
    activeTab === 'unread' &&
    !unread.hasMore &&
    !historyStale &&
    !isRevalidating &&
    countStatus === 'ready' &&
    unreadCount !== null &&
    !markAllPending &&
    !markingAsRead &&
    !isRecovering &&
    unreadNotifications.length > 0 &&
    unreadCount > loadedUnreadCount;



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
                hasMore={all.hasMore}
                isLoadingMore={all.isLoadingMore}
                pageError={all.pageError}
                onLoadMore={all.loadMore}
                onRecoverPagination={all.recoverPagination}
                isRecovering={all.isRecovering}
              />
            </TabsContent>

            <TabsContent
              value="unread"
              className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
            >
              {/* Older unread rows couldn't be re-verified. This is a freshness
                  warning, NOT a pagination failure — hence its own strip. */}
              {historyStale && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    Some older items may be out of date
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => void refreshUnreadHistory()}
                    disabled={isRevalidating || markAllPending || markingAsRead}
                  >
                    {isRevalidating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Refresh
                  </Button>
                </div>
              )}
              {/* Independent unread pagination: this lane has its own cursor, so
                  loading more here pulls older UNREAD rows only. */}
              <NotificationList
                notifications={unreadNotifications}
                loading={isUnreadInitialLoad}
                hasError={unreadHasError}
                onRetry={fetchAll}
                onNotificationClick={handleNotificationClick}
                emptyMessage="No unread notifications"
                emptyIcon={Check}
                hasMore={unread.hasMore}
                isLoadingMore={unread.isLoadingMore}
                pageError={unread.pageError}
                onLoadMore={unread.loadMore}
                onRecoverPagination={unread.recoverPagination}
                isRecovering={unread.isRecovering}
                showCountMismatch={showCountMismatch}
              />
            </TabsContent>

          </Tabs>
        </div>

        {/* Dev-only transport readout. Never shipped to users: realtime is a
            latency optimization, so its state is diagnostic, not product UI. */}
        {import.meta.env.DEV && (
          <div className="shrink-0 border-t px-4 py-1.5 text-[11px] text-muted-foreground">
            realtime: {realtimeStatus}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
