import { describe, expect, it } from 'vitest';
import type { MediaItem } from '@/types/media';
import { parsePublicFlags } from '@/hooks/useAppConfig';
import {
  REVIEW_VIDEO_COPY,
  canonicalMedia,
  serializeMediaForSave,
  videoPickPolicy,
  videoSaveBlocker,
  visibilityLockReason,
} from '../reviewVideo';
import { reviewVideoErrorMessage } from '../serverErrors';
import { buildEditTimelinePayload } from '../saveBuilders';
import { emptyComposerValues } from '../values';

const photo: MediaItem = { url: 'https://x/p.jpg', type: 'image', order: 0 };
const savedReady: MediaItem = {
  url: 'https://x/poster.jpg', type: 'video', order: 1, provider: 'mux',
  mux_upload_id: 'up_saved', mux_status: 'ready', mux_playback_id: 'pb_saved', mux_asset_id: 'as_saved',
};
const savedFailed: MediaItem = { ...savedReady, mux_upload_id: 'up_failed', mux_status: 'errored', mux_error: 'too_long', mux_playback_id: undefined };
const fresh: MediaItem = {
  url: 'https://x/new-poster.jpg', type: 'video', order: 1, provider: 'mux',
  mux_upload_id: 'up_new', mux_status: 'preparing', mux_playback_id: 'forged',
};

describe('setting', () => {
  it('fails closed', () => {
    expect(parsePublicFlags(null).reviews.video_enabled).toBe(false);
    expect(parsePublicFlags({ reviews: { video_enabled: 'true' } }).reviews.video_enabled).toBe(false);
    expect(parsePublicFlags({ reviews: { video_enabled: true } }).reviews.video_enabled).toBe(true);
  });
});

describe('videoPickPolicy', () => {
  it('setting off: no new picks, no message', () => {
    expect(videoPickPolicy({ settingOn: false, muxUploadsOn: true, visibility: 'public' })).toEqual({ allowVideo: false, reason: null });
  });
  it('Mux off: no plain-file fallback, explains', () => {
    expect(videoPickPolicy({ settingOn: true, muxUploadsOn: false, visibility: 'public' })).toEqual({ allowVideo: false, reason: REVIEW_VIDEO_COPY.unavailable });
  });
  it('public-only for reviews and parent reviews', () => {
    expect(videoPickPolicy({ settingOn: true, muxUploadsOn: true, visibility: 'private' }).reason).toBe(REVIEW_VIDEO_COPY.publicOnly);
    expect(videoPickPolicy({ settingOn: true, muxUploadsOn: true, visibility: 'circle_only', timeline: true }).reason).toBe(REVIEW_VIDEO_COPY.parentNotPublic);
    expect(videoPickPolicy({ settingOn: true, muxUploadsOn: true, visibility: 'public' }).allowVideo).toBe(true);
  });
});

describe('visibility lock is thread-wide', () => {
  it('root video, update video, none', () => {
    expect(visibilityLockReason([photo, savedReady], false)).toBe(REVIEW_VIDEO_COPY.visibilityLocked);
    expect(visibilityLockReason([photo], true)).toBe(REVIEW_VIDEO_COPY.threadVisibilityLocked);
    expect(visibilityLockReason([photo], false)).toBeNull();
  });
});

describe('serializeMediaForSave', () => {
  it('kept saved videos round-trip exactly (ready and failed)', () => {
    const out = serializeMediaForSave([photo, savedReady], [photo, savedReady]);
    expect(out[1]).toEqual(savedReady);
    const out2 = serializeMediaForSave([savedFailed], [savedFailed]);
    expect(out2[0]).toEqual(savedFailed);
  });
  it('uses the stored object even if the form copy was altered', () => {
    const tampered = { ...savedReady, mux_playback_id: 'x', mux_status: 'preparing' as const };
    expect(serializeMediaForSave([tampered], [savedReady])[0]).toEqual(savedReady);
  });
  it('new video drops trusted Mux fields, keeps identity and order', () => {
    const [v] = serializeMediaForSave([fresh], []);
    expect(v.mux_upload_id).toBe('up_new');
    expect(v.provider).toBe('mux');
    expect(v.order).toBe(1);
    expect(v).not.toHaveProperty('mux_status');
    expect(v).not.toHaveProperty('mux_playback_id');
  });
  it('preserves order and photos', () => {
    const out = serializeMediaForSave([{ ...savedReady, order: 0 }, { ...photo, order: 1 }], [photo, savedReady]);
    expect(out.map((m) => m.type)).toEqual(['video', 'image']);
    expect(out[0].order).toBe(0);
    expect(out[1]).toEqual({ ...photo, order: 1 });
  });
  it('replacement: old video gone, new one minimal', () => {
    const out = serializeMediaForSave([photo, fresh], [photo, savedReady]);
    expect(out.some((m) => m.mux_upload_id === 'up_saved')).toBe(false);
    expect(out[1]).not.toHaveProperty('mux_status');
  });
});

describe('timeline edit payload', () => {
  it('unrelated text edit keeps the saved video untouched', () => {
    const values = { ...emptyComposerValues(), text: 'changed', media: [photo, savedFailed] };
    const built = buildEditTimelinePayload({ values, reviewId: 'r', updateId: 'u', storedMedia: [photo, savedFailed] });
    expect(built.ok && built.payload.media[1]).toEqual(savedFailed);
  });
});

describe('videoSaveBlocker', () => {
  it('blocks only a failed NEW video', () => {
    expect(videoSaveBlocker([fresh], [], { up_new: { ui_status: 'failed' } })).toBe(REVIEW_VIDEO_COPY.newVideoFailed);
    expect(videoSaveBlocker([fresh], [], { up_new: { ui_status: 'processing' } })).toBeNull();
    expect(videoSaveBlocker([savedFailed], [savedFailed], { up_failed: { ui_status: 'failed' } })).toBeNull();
  });
});

describe('canonicalMedia', () => {
  it('ignores server-filled Mux details', () => {
    expect(canonicalMedia([photo, fresh])).toEqual(canonicalMedia([photo, { ...fresh, mux_status: 'ready', mux_playback_id: 'p', url: 'other' }]));
  });
});

describe('server error messages', () => {
  it('maps Phase 1 codes', () => {
    expect(reviewVideoErrorMessage({ message: 'review_video_public_only' })).toMatch(/public/);
    expect(reviewVideoErrorMessage({ message: 'review_media_one_video' })).toMatch(/one video/);
    expect(reviewVideoErrorMessage({ message: 'something else' })).toBeNull();
  });
});
