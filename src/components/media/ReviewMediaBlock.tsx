import React, { useCallback, useMemo, useState } from 'react';
import type { MediaItem, VideoHandoff, VideoExitHandoff } from '@/types/media';
import type { LightboxEntryExtras } from '@/components/media/lightboxTypes';
import { YelpStyleMediaPreview } from '@/components/media/YelpStyleMediaPreview';
import { LightboxPreview } from '@/components/media/LightboxPreview';
import { readGlobalVideoMuted, setGlobalVideoMuted } from '@/hooks/useVideoMute';
import { useFeedVideoManagerControls } from '@/hooks/useFeedVideoManager';
import {
  visibleReviewMedia,
  REVIEW_MEDIA_OWNER_COPY,
  type ReviewMediaOwnerKind,
} from '@/utils/reviewMediaDisplay';

interface ReviewMediaBlockProps {
  media: MediaItem[] | null | undefined;
  kind: ReviewMediaOwnerKind;
  ownerId: string;
  isOwner: boolean;
  /** Entry-specific edit eligibility (review hour, or update's own hour + latest). */
  canEdit: boolean;
  className?: string;
  gridClassName?: string;
}

/**
 * Review video Phase 3 — one media block for every review / timeline entry.
 * Grid and full-screen viewer share the same filtered, ordered list with
 * stable ids, so tapping item n opens item n, and playback time hands off
 * in and back out like the home feed.
 */
export function ReviewMediaBlock({
  media,
  kind,
  ownerId,
  isOwner,
  canEdit,
  className,
  gridClassName,
}: ReviewMediaBlockProps) {
  const { items, ownerNotice } = useMemo(
    () => visibleReviewMedia(media, { kind, ownerId, isOwner, canEdit }),
    [media, kind, ownerId, isOwner, canEdit],
  );
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [handoff, setHandoff] = useState<VideoHandoff | null>(null);
  const [extras, setExtras] = useState<LightboxEntryExtras | null>(null);
  const [resume, setResume] = useState<{ index: number; handoff: VideoExitHandoff } | null>(null);
  const { setLightboxOpen: setManagerLightboxOpen } = useFeedVideoManagerControls();

  const openAt = useCallback(
    (i: number, h?: VideoHandoff, x?: LightboxEntryExtras) => {
      setIndex(i);
      setHandoff(h ?? null);
      setExtras(x ?? null);
      setOpen(true);
      setManagerLightboxOpen(true);
    },
    [setManagerLightboxOpen],
  );

  const close = useCallback(() => {
    setOpen(false);
    setHandoff(null);
    setExtras(null);
    setManagerLightboxOpen(false);
  }, [setManagerLightboxOpen]);

  const onExit = useCallback((h: VideoExitHandoff) => {
    if (h.muted !== readGlobalVideoMuted()) setGlobalVideoMuted(h.muted);
    if (h.entryIndex === h.currentIndex) setResume({ index: h.entryIndex, handoff: h });
  }, []);

  if (items.length === 0 && !ownerNotice) return null;

  const notice =
    ownerNotice === 'failed_editable'
      ? REVIEW_MEDIA_OWNER_COPY.failedEditable
      : ownerNotice === 'failed_locked'
        ? kind === 'review'
          ? REVIEW_MEDIA_OWNER_COPY.failedLockedReview
          : REVIEW_MEDIA_OWNER_COPY.failedLockedUpdate
        : null;

  return (
    <div className={className}>
      {items.length > 0 && (
        <YelpStyleMediaPreview
          media={items}
          onImageClick={(i) => openAt(i)}
          className={gridClassName}
          playVideos
          onVideoTap={openAt}
          videoSource={kind}
          videoSourceId={ownerId}
          videoResume={resume}
          onResumeConsumed={() => setResume(null)}
        />
      )}
      {notice && (
        <p className="mt-2 text-xs text-muted-foreground" role="status" data-testid="review-video-owner-notice">
          {notice}
        </p>
      )}
      {open && items.length > 0 && (
        <LightboxPreview
          media={items}
          initialIndex={index}
          initialVideoState={handoff ?? undefined}
          entryExtras={extras ?? undefined}
          onExitHandoff={onExit}
          viewSource={kind}
          viewSourceId={ownerId}
          onClose={close}
        />
      )}
    </div>
  );
}
