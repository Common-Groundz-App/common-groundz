
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileAvatar } from "@/components/common/ProfileAvatar";
import { Notification, type PageError } from "@/services/notificationService";
import { formatNotificationTime } from "@/utils/dateUtils";
import {
  groupNotifications,
  formatGroupPrimary,
  getPreviewLine,
  groupAriaLabel,
  resolveActorName,
  type NotificationGroup,
} from "@/utils/notificationGrouping";
import {
  msUntilNextLocalMidnight,
  partitionIntoSections,
} from "@/utils/notificationSections";
import { useProfile } from "@/hooks/use-profile-cache";
import {
  useNotificationTargets,
  selectTargetThumbnail,
  type NotificationTargetMedia,
} from "@/hooks/notifications/useNotificationTargets";
import { getProxyUrlForImage } from "@/utils/imageUtils";



interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  /** Receives the whole group. Singletons arrive as a 1-event group, so the
   *  drawer has one code path for both. */
  onNotificationClick: (group: NotificationGroup, event: React.MouseEvent) => void;
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
}



/**
 * Target preview (Phase 3.3A).
 *
 * Decorative and non-interactive: it lives inside the row's existing button so
 * no nested interactive element is introduced (the row refactor stays in 3.3B).
 * While a known target is still resolving the slot is reserved to avoid a
 * layout shift; once it conclusively resolves to no media the slot disappears
 * and the text column reclaims the width. No placeholder box is ever shown.
 */
function TargetThumbnail({ url, pending }: { url: string | null; pending: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      <img
        src={getProxyUrlForImage(url)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-md object-cover bg-muted"
      />
    );
  }

  // Reserve only while the answer is genuinely unknown.
  if (pending && !failed) {
    return <div aria-hidden="true" className="h-10 w-10 shrink-0 rounded-md bg-muted/40" />;
  }

  return null;
}

/**
 * One rendered group.
 *
 * Extracted into its own component so it can call `useProfile` for the first
 * two actors — hooks can't run inside a `.map()` in the parent. Those lookups
 * use the SAME react-query key `ProfileAvatar` already uses (`['profile', id]`),
 * so react-query dedupes the request rather than issuing a second one.
 *
 * Exactly two fixed hook calls, never a loop. While a profile is in flight the
 * row shows its stored database sentence — no skeleton, no cleared row; the
 * text simply swaps in place once a verified name resolves.
 */
function NotificationRow({
  group,
  onNotificationClick,
  targetMedia,
}: {
  group: NotificationGroup;
  onNotificationClick: (group: NotificationGroup, event: React.MouseEvent) => void;
  targetMedia: NotificationTargetMedia;
}) {
  const { representative } = group;
  const actorIdA = group.actorIds[0];
  const actorIdB = group.actorIds[1];
  const { data: profileA } = useProfile(actorIdA);
  const { data: profileB } = useProfile(actorIdB);

  // Verified profiles only — a fallback "Anonymous User" resolves to null and
  // the row keeps whatever sentence the database stored.
  const names = [
    resolveActorName(profileA, actorIdA),
    resolveActorName(profileB, actorIdB),
  ];

  const primary = formatGroupPrimary(group, names);
  const preview = getPreviewLine(representative);
  const timestamp = formatNotificationTime(representative.created_at);
  // Stacked avatars are capped at 3.
  const stackedActorIds = group.actorIds.slice(0, 3);
  // An aggregated group shares one target, so this is one lookup per group.
  const { url: thumbnailUrl, pending: thumbnailPending } = selectTargetThumbnail(
    targetMedia,
    representative,
  );


  return (
    <button
      onClick={(e) => onNotificationClick(group, e)}
      aria-label={groupAriaLabel(group, names)}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        group.isUnread && "bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        {stackedActorIds.length > 0 ? (
          <div className="flex shrink-0 -space-x-2">
            {stackedActorIds.map((actorId) => (
              <ProfileAvatar
                key={actorId}
                userId={actorId}
                size="sm"
                className="h-9 w-9 shrink-0 ring-2 ring-background rounded-full"
              />
            ))}
          </div>
        ) : (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <Bell className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm leading-5 text-foreground",
              group.isUnread && "font-medium"
            )}
          >
            {primary}
          </p>
          {preview && (
            <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">
              {preview}
            </p>
          )}
          {/* Read state sits beside the timestamp so the right edge belongs to
              the target thumbnail. The check keeps its own colour/size so
              unread vs read stays obvious at a glance. */}
          <div className="mt-1 flex items-center gap-1.5">
            {timestamp && (
              <span className="text-[11px] text-muted-foreground/75">{timestamp}</span>
            )}
            {group.isUnread ? (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
            ) : (
              <Check aria-hidden="true" className="h-3 w-3 shrink-0 text-primary/50" />
            )}
          </div>
        </div>
        {/* Decorative preview of the CONTENT this notification points at.
            Never the actor avatar, never notifications.image_url. */}
        <TargetThumbnail url={thumbnailUrl} pending={thumbnailPending} />
      </div>

    </button>
  );
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
}: NotificationListProps) {
  // Display-only transform over the rows this lane has loaded. Hooks run before
  // any early return so the order stays stable across loading/empty/error states.
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);

  // `now` drives date sectioning. It lives in state (not a fresh Date on every
  // render) and advances exactly once per local midnight, so a drawer left open
  // overnight relabels instead of keeping yesterday's rows under "Today".
  // setTimeout per the project's background-timer rule — never setInterval.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), msUntilNextLocalMidnight(now));
    return () => clearTimeout(timer);
  }, [now]);

  const sections = useMemo(() => partitionIntoSections(groups, now), [groups, now]);

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
        {/* Each lane now paginates its own dataset, so an empty Unread lane
            genuinely means "nothing unread loaded" — but older pages may still
            exist, hence the footer below. */}
        <p className="text-sm text-muted-foreground px-6">{emptyMessage}</p>
        {onLoadMore && hasMore && (
          <PaginationFooter
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            pageError={pageError}
            onLoadMore={onLoadMore}
            onRecoverPagination={onRecoverPagination}
            isRecovering={isRecovering}
          />
        )}
      </div>
    );
  }


  return (

    <div className="px-2 py-1">
      {sections.map((section) => (
        <section key={section.label} aria-label={section.label}>
          {/* Sticks to the top of the drawer's scroll region. The tabs live
              OUTSIDE that region, so top-0 is correct — no offset hacks. */}
          <h3 className="sticky top-0 z-10 -mx-2 px-3 py-1.5 bg-background/85 backdrop-blur-sm text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {section.label}
          </h3>
          {section.groups.map((group) => (
            <NotificationRow
              key={group.key}
              group={group}
              onNotificationClick={onNotificationClick}
              targetMedia={targetMedia}
            />
          ))}

        </section>
      ))}


      {onLoadMore && (
        <PaginationFooter
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          pageError={pageError}
          onLoadMore={onLoadMore}
          onRecoverPagination={onRecoverPagination}
          isRecovering={isRecovering}
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
