import type { MediaItem } from '@/types/media';
import { isMuxItem, isMuxPlayable, isMuxPreparing, isMuxErroredOrBroken } from '@/utils/muxMedia';
import { VIDEO_OWNER_COPY } from '@/utils/videoTileCopy';

/**
 * One display rule for every place review / timeline-update media is drawn.
 *
 * - Photos, legacy stored videos, ready Mux video: shown.
 * - Processing Mux video: author sees processing; others a neutral
 *   "Video processing" tile (slot kept so the entry never looks empty).
 * - Failed / too-long Mux video: author gets a recovery note that depends on
 *   the entry's own edit hour; others a neutral "Video unavailable" tile.
 */
export type ReviewMediaDisplayState =
  | 'show'
  | 'owner_processing'
  | 'owner_failed_editable'
  | 'owner_failed_locked'
  | 'viewer_processing'
  | 'viewer_unavailable';

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
    if (!ctx.isOwner) return 'viewer_unavailable';
    return ctx.canEdit ? 'owner_failed_editable' : 'owner_failed_locked';
  }
  if (isMuxPreparing(item)) return ctx.isOwner ? 'owner_processing' : 'viewer_processing';
  return ctx.isOwner ? (ctx.canEdit ? 'owner_failed_editable' : 'owner_failed_locked') : 'viewer_unavailable';
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
      return true;
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

export const REVIEW_MEDIA_OWNER_COPY = VIDEO_OWNER_COPY;
