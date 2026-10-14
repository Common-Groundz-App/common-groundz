import type { MediaItem } from '@/types/media';
import type { MuxStatusRow, MuxUiStatus } from '@/hooks/useMuxStatus';
import { muxHlsUrl, muxThumbnailUrl } from '@/utils/muxMedia';

export type ComposerMuxStatus = Partial<MuxStatusRow> & { ui_status: MuxUiStatus };
export type ComposerMuxStatuses = Record<string, ComposerMuxStatus | undefined>;

export const VIDEO_PREPARATION_COPY = {
  processing: 'Processing video… You can keep writing. Wait until it is ready before publishing.',
  failed: "Your new video couldn't be processed. Remove it to save.",
  tooLong: 'Video too long. Keep it under 60 seconds. Remove or replace it to save.',
} as const;

export function composerMuxState(row: ComposerMuxStatus | undefined): MuxUiStatus {
  if (row?.ui_status === 'failed' || row?.error || (typeof row?.duration === 'number' && row.duration > 60)) return 'failed';
  if (row?.ui_status === 'ready' && row.asset_id && row.playback_id &&
      typeof row.duration === 'number' && Number.isFinite(row.duration) && row.duration > 0) return 'ready';
  return 'processing';
}

/** Kept saved videos and stored-file videos retain their previous save contract. */
export function isNewMuxVideo(item: MediaItem, stored: readonly MediaItem[]): boolean {
  return item.type === 'video' && item.provider === 'mux' &&
    !stored.some((old) => old.type === 'video' && !!old.mux_upload_id && old.mux_upload_id === item.mux_upload_id);
}

export function newMuxVideoSaveBlocker(media: readonly MediaItem[], stored: readonly MediaItem[], statuses: ComposerMuxStatuses): string | null {
  for (const item of media) {
    if (!isNewMuxVideo(item, stored)) continue;
    const row = item.mux_upload_id ? statuses[item.mux_upload_id] : undefined;
    if (typeof row?.duration === 'number' && row.duration > 60) return VIDEO_PREPARATION_COPY.tooLong;
    const status = composerMuxState(row);
    if (status === 'failed') return VIDEO_PREPARATION_COPY.failed;
    if (status !== 'ready') return VIDEO_PREPARATION_COPY.processing;
  }
  return null;
}

/** Composer only. Never persist this projection or use upload truth on viewer cards. */
export function preparedComposerMedia(media: readonly MediaItem[], stored: readonly MediaItem[], statuses: ComposerMuxStatuses): MediaItem[] {
  return media.map((item) => {
    if (!isNewMuxVideo(item, stored)) return item;
    const row = item.mux_upload_id ? statuses[item.mux_upload_id] : undefined;
    if (!row || composerMuxState(row) !== 'ready' || !row.playback_id || !row.asset_id) return item;
    return { ...item, mux_status: 'ready', mux_asset_id: row.asset_id, mux_playback_id: row.playback_id,
      mux_error: undefined, duration: row.duration ?? undefined, url: muxHlsUrl(row.playback_id), thumbnail_url: muxThumbnailUrl(row.playback_id) };
  });
}
/** Stable removal identity: id, then mux_upload_id, then url (legacy photos only). Never index. */
export interface MediaIdentity { id?: string; muxUploadId?: string; url?: string }
export function mediaIdentity(item: MediaItem): MediaIdentity {
  if (item.id) return { id: item.id };
  if (item.mux_upload_id) return { muxUploadId: item.mux_upload_id };
  return { url: item.url };
}
export function matchesMediaIdentity(item: MediaItem, key: MediaIdentity): boolean {
  if (key.id) return item.id === key.id;
  if (key.muxUploadId) return item.mux_upload_id === key.muxUploadId;
  return !!key.url && !item.id && !item.mux_upload_id && item.url === key.url;
}

/**
 * Composer-only player input. Items with a local preview get a frozen item
 * (captured once per id) so no player source dependency changes on Ready;
 * others get their prepared version, matched by identity, never by index.
 * Never use the result for validation or the save payload.
 */
export function composerPreviewMedia(
  media: readonly MediaItem[],
  prepared: readonly MediaItem[],
  hasLocalPreview: (id: string) => boolean,
  frozen: Map<string, MediaItem>,
): MediaItem[] {
  return media.map((item) => {
    if (item.id && hasLocalPreview(item.id)) {
      let f = frozen.get(item.id);
      if (!f) { f = item; frozen.set(item.id, item); }
      return f.order === item.order ? f : { ...f, order: item.order };
    }
    const key = mediaIdentity(item);
    return prepared.find((p) => matchesMediaIdentity(p, key)) ?? item;
  });
}
