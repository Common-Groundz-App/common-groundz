import type { MediaItem } from '@/types/media';
import { isMuxItem, isMuxPlayable, isMuxPreparing, isMuxErroredOrBroken } from '@/utils/muxMedia';

/**
 * Review video Phase 3 — one display rule for every place review /
 * timeline-update media is drawn (cards, timeline viewer, gallery).
 *
 * - Photos and legacy stored videos: always shown.
 * - Ready Mux video: shown to everyone.
 * - Processing Mux video: author only; hidden for everyone else.
 * - Failed / too-long Mux video: author only (with a recovery note that
 *   depends on whether that entry's own edit hour is still open); hidden
 *   for everyone else, with no failure details.
 */
export type ReviewMediaDisplayState =
  | 'show'
  | 'owner_processing'
  | 'owner_failed_editable'
  | 'owner_failed_locked'
  | 'hidden';

export interface ReviewMediaViewerContext {
  isOwner: boolean;
  /** Entry-specific: review window for reviews; own time + latest for updates. */
  canEdit: boolean;
}

export type ReviewMediaOwnerKind = 'review' | 'review_update';

export function displayStateFor(item: MediaItem, ctx: ReviewMediaViewerContext): ReviewMediaDisplayState {
  if (item.type !== 'video' || !isMuxItem(item)) return 'show';
  if (isMuxPlayable(item)) return 'show';
  if (isMuxErroredOrBroken(item)) {
    if (!ctx.isOwner) return 'hidden';
    return ctx.canEdit ? 'owner_failed_editable' : 'owner_failed_locked';
  }
  if (isMuxPreparing(item)) return ctx.isOwner ? 'owner_processing' : 'hidden';
  return 'hidden';
}

/** Stable identity: never array position, so filtering/reordering can't swap playback state. */
export function stableReviewMediaId(
  kind: ReviewMediaOwnerKind,
  ownerId: string,
  item: Pick<MediaItem, 'mux_upload_id' | 'id' | 'url'>,
): string {
  const key = item.mux_upload_id || item.id || item.url || 'unknown';
  return `${kind}:${ownerId}:${key}`;
}

export interface VisibleReviewMedia {
  items: MediaItem[];
  /** Author-only recovery note for a failed video in this entry. */
  ownerNotice: 'failed_editable' | 'failed_locked' | null;
}

export function visibleReviewMedia(
  media: MediaItem[] | null | undefined,
  ctx: ReviewMediaViewerContext & { kind: ReviewMediaOwnerKind; ownerId: string },
): VisibleReviewMedia {
  let ownerNotice: VisibleReviewMedia['ownerNotice'] = null;
  const items = (Array.isArray(media) ? media : [])
    .filter((m) => m && !m.is_deleted)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .filter((m) => {
      const state = displayStateFor(m, ctx);
      if (state === 'owner_failed_editable') ownerNotice = 'failed_editable';
      if (state === 'owner_failed_locked' && ownerNotice !== 'failed_editable') ownerNotice = 'failed_locked';
      return state !== 'hidden';
    })
    .map((m) => ({ ...m, id: stableReviewMediaId(ctx.kind, ctx.ownerId, m) }));
  return { items, ownerNotice };
}

/** Gallery (Photos tab): photos with an address, and only playable videos. */
export function isGalleryVisible(item: MediaItem): boolean {
  if (!item || item.is_deleted) return false;
  if (item.type === 'image') return !!item.url;
  if (item.type !== 'video') return false;
  if (isMuxItem(item)) return isMuxPlayable(item);
  return !!item.url;
}

export const REVIEW_MEDIA_OWNER_COPY = {
  failedEditable: "Couldn't process this video. Edit to remove or replace it.",
  failedLockedReview:
    "Couldn't process this video. You can delete this review or add a timeline update.",
  failedLockedUpdate:
    "Couldn't process this video. You can delete this update or add a new timeline update.",
} as const;
