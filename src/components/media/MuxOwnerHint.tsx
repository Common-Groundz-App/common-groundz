import * as React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMuxStatus } from '@/hooks/useMuxStatus';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { isPostOwner } from '@/lib/isPostOwner';
import { isMuxPreparing, isMuxErroredOrBroken } from '@/utils/muxMedia';
import { canEditPost } from '@/utils/postEditPolicy';
import { analytics } from '@/services/analytics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  EnhancedCreatePostForm,
  type PostToEdit,
} from '@/components/feed/EnhancedCreatePostForm';
import type { MediaItem } from '@/types/media';

interface Props {
  post:
    | {
        id?: string;
        user_id?: string | null;
        authorId?: string | null;
        media?: MediaItem[] | null;
        created_at?: string | null;
        last_edited_at?: string | null;
        title?: string | null;
        content?: string | null;
        visibility?: 'public' | 'circle_only' | 'private';
        post_type?: string | null;
        structured_fields?: Record<string, any> | null;
        tagged_entities?: any[];
      }
    | null
    | undefined;
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
 *
 * Phase 3C.2-lite — when the banner shows the failed state AND the owner is
 * still inside the edit window (or is admin), surfaces an "Edit post" CTA
 * that opens the existing edit composer. The user removes the failed Mux
 * item with the composer's existing X button and re-uploads; Phase 3C.1's
 * mux-sync-post-mappings handles the mapping transitions on save.
 */
export function MuxOwnerHint({ post, onReady, className }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

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

  // ─── Phase 3C.2-lite: failed-video Edit CTA ──────────────────────────────
  const canEdit = React.useMemo(
    () =>
      canEditPost(
        post
          ? {
              user_id: post.user_id ?? post.authorId ?? null,
              created_at: post.created_at ?? null,
              last_edited_at: post.last_edited_at ?? null,
            }
          : null,
        user?.id ?? null,
        isAdmin,
      ),
    [post, user?.id, isAdmin],
  );

  const [isEditOpen, setIsEditOpen] = React.useState(false);

  // Dedup analytics per post_id per mount. Reset when post.id changes so
  // navigating across failed posts in the same mount fires shown correctly.
  const shownCtaRef = React.useRef<string | null>(null);
  const completedCtaRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    shownCtaRef.current = null;
    completedCtaRef.current = null;
  }, [post?.id]);

  React.useEffect(() => {
    if (bannerStatus !== 'failed' || !canEdit) return;
    const key = post?.id ?? '';
    if (shownCtaRef.current === key) return;
    shownCtaRef.current = key;
    try {
      analytics.track('mux_failed_edit_cta_shown', {
        post_id: post?.id ?? null,
      });
    } catch {}
  }, [bannerStatus, canEdit, post?.id]);

  const handleEditClick = React.useCallback(() => {
    try {
      analytics.track('mux_failed_edit_cta_clicked', {
        post_id: post?.id ?? null,
      });
    } catch {}
    setIsEditOpen(true);
  }, [post?.id]);

  const handleEditSuccess = React.useCallback(() => {
    const key = post?.id ?? '';
    if (completedCtaRef.current !== key) {
      completedCtaRef.current = key;
      try {
        analytics.track('mux_failed_edit_cta_completed', {
          post_id: post?.id ?? null,
        });
      } catch {}
    }
    setIsEditOpen(false);
    onReady?.();
  }, [onReady, post?.id]);

  if (!shouldSubscribe || !bannerStatus) return null;

  const showEditCta = bannerStatus === 'failed' && canEdit;

  return (
    <>
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
        <div className="flex-1 leading-relaxed">
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
                {showEditCta
                  ? 'Edit your post to remove and re-upload the video.'
                  : 'Please create a new post.'}
              </span>
            </>
          )}
        </div>
        {showEditCta && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={handleEditClick}
          >
            Edit post
          </Button>
        )}
      </div>

      {showEditCta && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <EnhancedCreatePostForm
              postToEdit={post as unknown as PostToEdit}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default MuxOwnerHint;
