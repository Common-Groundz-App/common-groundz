import * as React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMuxStatus } from '@/hooks/useMuxStatus';
import { isPostOwner } from '@/lib/isPostOwner';
import { isMuxPreparing, isMuxErroredOrBroken } from '@/utils/muxMedia';
import { analytics } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/types/media';

interface Props {
  post: {
    id?: string;
    user_id?: string | null;
    authorId?: string | null;
    media?: MediaItem[] | null;
  } | null | undefined;
  onReady?: () => void;
  className?: string;
}

/**
 * Owner-only "your video is processing / failed" banner on PostView.
 *
 * Subscribes to mux_uploads realtime ONLY when:
 *  - the viewer is the post owner, AND
 *  - the post.media contains at least one Mux item that is preparing or errored.
 *
 * Auto-unmounts once all observed uploads reach ready.
 */
export function MuxOwnerHint({ post, onReady, className }: Props) {
  const { user } = useAuth();

  const owner = isPostOwner(post ?? null, user);

  const muxItems = React.useMemo(() => {
    if (!owner || !post?.media) return [] as MediaItem[];
    return post.media.filter(
      (m) => isMuxPreparing(m) || isMuxErroredOrBroken(m),
    );
  }, [owner, post?.media]);

  const uploadIds = React.useMemo(
    () =>
      muxItems
        .map((m) => m.mux_upload_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    [muxItems],
  );

  const shouldSubscribe = owner && muxItems.length > 0;

  const handleReady = React.useCallback(
    (uploadId: string) => {
      try {
        analytics.track('mux_owner_hint_dismissed_ready', {
          post_id: post?.id ?? null,
          upload_id: uploadId,
        });
      } catch {}
      onReady?.();
    },
    [onReady, post?.id],
  );

  const handleChange = React.useCallback(
    (row: { upload_id: string; ui_status: string }) => {
      try {
        analytics.track('mux_upload_status_changed', {
          upload_id: row.upload_id,
          ui_status: row.ui_status,
          surface: 'owner_hint',
          post_id: post?.id ?? null,
        });
      } catch {}
    },
    [post?.id],
  );

  const statuses = useMuxStatus(shouldSubscribe ? uploadIds : [], {
    onReady: handleReady,
    onChange: handleChange,
  });

  // Compose a single banner status:
  //  - if any tracked upload is failed -> failed
  //  - else if any is processing (or unknown) -> processing
  //  - else nothing (all ready) -> unmount
  const bannerStatus: 'processing' | 'failed' | null = React.useMemo(() => {
    if (!shouldSubscribe) return null;

    const hasFailed = muxItems.some((m) => {
      const id = m.mux_upload_id;
      const s = id ? statuses[id]?.ui_status : undefined;
      if (s === 'failed') return true;
      if (!s && isMuxErroredOrBroken(m)) return true;
      return false;
    });
    if (hasFailed) return 'failed';

    const hasPending = muxItems.some((m) => {
      const id = m.mux_upload_id;
      const s = id ? statuses[id]?.ui_status : undefined;
      if (s === 'ready') return false;
      if (s === 'processing' || s === undefined) {
        return isMuxPreparing(m) || s === 'processing';
      }
      return false;
    });
    return hasPending ? 'processing' : null;
  }, [shouldSubscribe, muxItems, statuses]);

  // Fire shown analytics once per banner status transition.
  const lastTrackedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!bannerStatus) return;
    const key = `${post?.id ?? ''}:${bannerStatus}`;
    if (lastTrackedRef.current === key) return;
    lastTrackedRef.current = key;
    try {
      if (bannerStatus === 'processing') {
        analytics.track('mux_owner_hint_shown', {
          post_id: post?.id ?? null,
          ui_status: 'processing',
        });
      } else if (bannerStatus === 'failed') {
        analytics.track('mux_owner_hint_failed_shown', {
          post_id: post?.id ?? null,
        });
      }
    } catch {}
  }, [bannerStatus, post?.id]);

  if (!shouldSubscribe || !bannerStatus) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        bannerStatus === 'processing' &&
          'border-border bg-muted text-foreground',
        bannerStatus === 'failed' &&
          'border-destructive/40 bg-destructive/10 text-foreground',
        className,
      )}
    >
      {bannerStatus === 'processing' ? (
        <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
      )}
      <div className="leading-relaxed">
        {bannerStatus === 'processing' ? (
          <>
            <span className="font-medium">Your video is processing.</span>{' '}
            <span className="text-muted-foreground">
              Usually under a minute — playback will appear here automatically.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Video failed to process.</span>{' '}
            <span className="text-muted-foreground">
              Please edit if allowed or create a new post.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default MuxOwnerHint;
