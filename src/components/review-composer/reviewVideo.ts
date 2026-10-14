/**
 * Review video (Phase 2) — pure rules for the new Review / Timeline composers.
 *
 * The Phase 1 database rules stay the authority. These helpers only:
 *  - decide whether a NEW video may be picked (setting, Mux, public-only);
 *  - explain the visibility lock early;
 *  - serialize media so trusted Mux fields are never invented or stripped;
 *  - decide which video states block Save.
 */
import type { MediaItem } from '@/types/media';
import { newMuxVideoSaveBlocker, type ComposerMuxStatuses } from '@/utils/composerVideoReadiness';
import type { ReviewVisibility } from './values';

export const REVIEW_VIDEO_COPY = {
  publicOnly: 'Videos are available on public reviews only.',
  parentNotPublic: 'Videos can only be added when the review is public.',
  visibilityLocked: 'This review has a video, so it must stay public. Remove the video to change who can see it.',
  threadVisibilityLocked: 'A timeline update on this review has a video, so the review must stay public.',
  unavailable: 'Video uploads are unavailable right now. You can still add photos.',
  waitForUpload: 'Wait for your video to finish uploading.',
  newVideoFailed: "Your new video couldn't be processed. Remove it to save.",
} as const;

/** Fields only the server may set on a video item. */
const TRUSTED_MUX_FIELDS = ['mux_status', 'mux_playback_id', 'mux_asset_id', 'mux_error'] as const;

export const isVideo = (m: MediaItem) => m.type === 'video';
export const hasVideo = (media: readonly MediaItem[] | null | undefined) => !!media?.some(isVideo);

function storedVideoFor(item: MediaItem, stored: readonly MediaItem[]): MediaItem | undefined {
  if (!isVideo(item) || !item.mux_upload_id) return undefined;
  return stored.find((s) => isVideo(s) && s.mux_upload_id === item.mux_upload_id);
}

/** A video on the form that is not part of the saved entry. */
export function isNewVideo(item: MediaItem, stored: readonly MediaItem[]): boolean {
  return isVideo(item) && !storedVideoFor(item, stored);
}

/**
 * Media payload for a save.
 * - Photos: copied as today.
 * - Saved video the author kept: the loaded object, unchanged (only `order`
 *   follows the form), so trusted Mux details round-trip untouched.
 * - New video: identity + display fields only; trusted Mux fields removed.
 */
export function serializeMediaForSave(media: readonly MediaItem[], stored: readonly MediaItem[] = []): MediaItem[] {
  return media.map((m) => {
    if (!isVideo(m)) return { ...m };
    const saved = storedVideoFor(m, stored);
    if (saved) return { ...saved, order: m.order ?? saved.order };
    const copy: Record<string, unknown> = { ...m };
    for (const k of TRUSTED_MUX_FIELDS) delete copy[k];
    return copy as unknown as MediaItem;
  });
}

/**
 * Canonical media for comparing a save attempt with a reloaded record.
 * Video items compare by identity and order only, so Mux details the server
 * fills in during processing never make a real save look different.
 */
export function canonicalMedia(media: unknown): unknown {
  if (!Array.isArray(media)) return media ?? null;
  return (media as MediaItem[]).map((m) =>
    m && isVideo(m) ? { type: 'video', mux_upload_id: m.mux_upload_id ?? null, order: m.order ?? null } : m,
  );
}

export interface VideoPickInput {
  /** `reviews.video_enabled`, resolved fail-closed. */
  settingOn: boolean;
  /** `mux.uploads_enabled`, resolved fail-closed. */
  muxUploadsOn: boolean;
  /** Visibility the video would be published under (review or parent review). */
  visibility: ReviewVisibility;
  /** True for timeline composers (message wording only). */
  timeline?: boolean;
}

export interface VideoPickPolicy {
  allowVideo: boolean;
  /** Shown when the setting is on but a video can't be picked right now. */
  reason: string | null;
}

/** Whether a NEW video may be picked. Never affects saved videos. */
export function videoPickPolicy(i: VideoPickInput): VideoPickPolicy {
  if (!i.settingOn) return { allowVideo: false, reason: null };
  if (!i.muxUploadsOn) return { allowVideo: false, reason: REVIEW_VIDEO_COPY.unavailable };
  if (i.visibility !== 'public') {
    return { allowVideo: false, reason: i.timeline ? REVIEW_VIDEO_COPY.parentNotPublic : REVIEW_VIDEO_COPY.publicOnly };
  }
  return { allowVideo: true, reason: null };
}

/** Why Private / Circle are unavailable on the review, or null. */
export function visibilityLockReason(rootMedia: readonly MediaItem[], updatesHaveVideo: boolean): string | null {
  if (hasVideo(rootMedia)) return REVIEW_VIDEO_COPY.visibilityLocked;
  if (updatesHaveVideo) return REVIEW_VIDEO_COPY.threadVisibilityLocked;
  return null;
}

/**
 * Save blocker from video state. Uploading is handled by the uploader's
 * in-flight flag. New Mux videos must be processed and duration-verified;
 * a saved video that failed later does not block unrelated edits.
 */
export function videoSaveBlocker(
  media: readonly MediaItem[],
  stored: readonly MediaItem[],
  statuses: ComposerMuxStatuses,
): string | null {
  return newMuxVideoSaveBlocker(media, stored, statuses);
}

export function muxUploadIds(media: readonly MediaItem[]): string[] {
  return media.flatMap((m) => isVideo(m) && m.provider === 'mux' && m.mux_upload_id ? [m.mux_upload_id] : []);
}
