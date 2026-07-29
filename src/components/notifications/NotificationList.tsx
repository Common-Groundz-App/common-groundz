
import React, { useEffect, useRef } from 'react';
import { Bell, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileAvatar } from "@/components/common/ProfileAvatar";
import { Notification, type PageError } from "@/services/notificationService";
import { formatNotificationTime } from "@/utils/dateUtils";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onNotificationClick: (notification: Notification, event: React.MouseEvent) => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  hasError?: boolean;
  onRetry?: () => void;
  // --- pagination ---
  hasMore?: boolean;
  isLoadingMore?: boolean;
  pageError?: PageError;
  onLoadMore?: (opts?: { force?: boolean }) => void;
  /** Invoked for `invalid-cursor` only — retrying a malformed cursor can never
   *  succeed, so that path gets Reload instead of Retry. */
  onRecoverPagination?: () => void;
  isRecovering?: boolean;
  /** True only when the global count is authoritative AND exceeds what's loaded. */
  showCountMismatch?: boolean;
  /** Rendered instead of the plain empty state on the Unread tab when older
   *  unread rows exist but haven't been paged in yet. */
  unloadedUnreadMessage?: string | null;
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

/**
 * Pagination footer.
 *
 * A real focusable <button> is the primary control — an IntersectionObserver
 * alone is unreliable inside a Sheet and unreachable by keyboard. The observer
 * is a progressive enhancement that calls the SAME callback (never a synthetic
 * click), and stays inert while a page error is showing so it can't retry-loop
 * against a broken cursor.
 */
function PaginationFooter({
  hasMore,
  isLoadingMore,
  pageError,
  onLoadMore,
  onRecoverPagination,
  isRecovering = false,
}: {
  hasMore: boolean;
  isLoadingMore: boolean;
  pageError: PageError;
  onLoadMore: (opts?: { force?: boolean }) => void;
  onRecoverPagination?: () => void;
  isRecovering?: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Deliberately disabled while an error is shown or while recovery runs —
    // recovery is the explicit button's job.
    if (!hasMore || pageError || isLoadingMore || isRecovering) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '120px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, pageError, isLoadingMore, isRecovering, onLoadMore]);

  if (!hasMore) return null;

  // A structurally invalid cursor can never succeed on retry, so that path gets
  // its own copy and routes to recovery rather than to the same request again.
  const isInvalidCursor = pageError === 'invalid-cursor';

  return (
    <div className="px-3 py-3">
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      {pageError ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">
            {isInvalidCursor ? "Couldn't continue loading" : "Couldn't load more"}
          </span>
          {isInvalidCursor ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => onRecoverPagination?.()}
              disabled={isRecovering || isLoadingMore || !onRecoverPagination}
            >
              {isRecovering ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Reload
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              // force: true clears the error guard first — a plain loadMore()
              // would be refused while pageError is still set.
              onClick={() => onLoadMore({ force: true })}
              disabled={isLoadingMore || isRecovering}
            >
              Retry
            </Button>
          )}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full text-xs"
          onClick={() => onLoadMore()}
          disabled={isLoadingMore || isRecovering}
        >
          {isLoadingMore ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Loading more…
            </>
          ) : (
            'Load more'
          )}
        </Button>
      )}
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
  onRetry,
  hasMore = false,
  isLoadingMore = false,
  pageError = null,
  onLoadMore,
  onRecoverPagination,
  isRecovering = false,
  showCountMismatch = false,
  unloadedUnreadMessage = null,
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
        {/* On the Unread tab, an empty page is NOT proof of zero unread — older
            unread rows may simply not be paged in yet. */}
        <p className="text-sm text-muted-foreground px-6">
          {unloadedUnreadMessage ?? emptyMessage}
        </p>
        {unloadedUnreadMessage && onLoadMore && hasMore && (
          <PaginationFooter
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            pageError={pageError}
            onLoadMore={onLoadMore}
          />
        )}
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

      {onLoadMore && (
        <PaginationFooter
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          pageError={pageError}
          onLoadMore={onLoadMore}
        />
      )}

      {/* Only rendered when the count is fully authoritative — see the drawer's
          guard. A count failure must never produce alarming copy. */}
      {!hasMore && showCountMismatch && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 mx-1 mb-2">
          <span className="text-xs text-muted-foreground">Some notifications may not be shown</span>
          {onRetry && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onRetry}>
              Refresh
            </Button>
          )}
        </div>
      )}

      {!hasMore && !showCountMismatch && (
        <p className="py-3 text-center text-[11px] text-muted-foreground/70">
          You're all caught up
        </p>
      )}
    </div>
  );
}
