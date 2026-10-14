import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { composerReducer, initialComposerState } from '@/components/review-composer/store';
import { mediaIdentity, preparedComposerMedia } from '@/utils/composerVideoReadiness';
import { VideoRecheckLink, RECHECK_AFTER_MS } from '@/components/feed/composer/VideoRecheckLink';
import type { MediaItem } from '@/types/media';

const photo: MediaItem = { url: 'p.jpg', type: 'image', order: 0, id: 'photo-1' };
const video: MediaItem = { url: '', type: 'video', order: 1, id: 'vid-1', provider: 'mux', mux_upload_id: 'up-1', mux_status: 'preparing' };
const ready = { up: { ui_status: 'ready' as const, asset_id: 'a', playback_id: 'pb', duration: 8 } };

describe('removal by stable identity after Ready', () => {
  it('removes the ready video even though its preview url changed', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'MEDIA_ADDED', sessionKey: 'k', media: photo });
    s = composerReducer(s, { type: 'MEDIA_ADDED', sessionKey: 'k', media: video });
    const shown = preparedComposerMedia(s.values.media, [], { 'up-1': ready.up });
    expect(shown[1].url).not.toBe(video.url);
    s = composerReducer(s, { type: 'MEDIA_REMOVED', sessionKey: 'k', ...mediaIdentity(shown[1]) });
    expect(s.values.media.map((m) => m.id)).toEqual(['photo-1']);
    expect(s.values.media).toHaveLength(1); // one slot freed
  });
  it('falls back to mux_upload_id, never index', () => {
    const noId = { ...video, id: undefined };
    expect(mediaIdentity(noId)).toEqual({ muxUploadId: 'up-1' });
  });
});

describe('VideoRecheckLink', () => {
  it('hidden during normal processing, shown after a long wait or reconnect', () => {
    vi.useFakeTimers();
    const { rerender } = render(<VideoRecheckLink active />);
    expect(screen.queryByText('Check again')).toBeNull();
    act(() => { vi.advanceTimersByTime(RECHECK_AFTER_MS); });
    expect(screen.getByText('Check again')).toBeTruthy();
    rerender(<VideoRecheckLink active={false} />);
    expect(screen.queryByText('Check again')).toBeNull();
    rerender(<VideoRecheckLink active />);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.getByText('Check again')).toBeTruthy();
    vi.useRealTimers();
  });
});

import { composerPreviewMedia } from '@/utils/composerVideoReadiness';
describe('composerPreviewMedia (post composer player input)', () => {
  const v: MediaItem = { url: '', type: 'video', order: 0, id: 'v1', provider: 'mux', mux_upload_id: 'u1', mux_status: 'preparing' };
  const saved: MediaItem = { url: 'old', type: 'video', order: 1, id: 's1', provider: 'mux', mux_upload_id: 'u2', mux_status: 'ready', mux_playback_id: 'pb2' };
  it('keeps every player source field identical through Processing → Ready for local previews', () => {
    const frozen = new Map<string, MediaItem>();
    const local = (id: string) => id === 'v1';
    const before = composerPreviewMedia([v, saved], preparedComposerMedia([v, saved], [saved], {}), local, frozen)[0];
    const readyStatuses = { u1: { ui_status: 'ready' as const, asset_id: 'a', playback_id: 'pb', duration: 8 } };
    // Even if raw media were patched on Ready, the frozen item wins.
    const patched = { ...v, mux_status: 'ready' as const, mux_playback_id: 'pb', url: 'https://stream.mux.com/pb.m3u8' };
    const after = composerPreviewMedia([patched, saved], preparedComposerMedia([patched, saved], [saved], readyStatuses), local, frozen)[0];
    for (const k of ['url', 'mux_playback_id', 'mux_status', 'provider', 'id'] as const) expect(after[k]).toBe(before[k]);
  });
  it('matches prepared items by identity even when order differs; saved videos use Mux', () => {
    const prepared = [saved, v];
    const out = composerPreviewMedia([v, saved], prepared, () => false, new Map());
    expect(out.map((m) => m.id)).toEqual(['v1', 's1']);
    expect(out[1].mux_playback_id).toBe('pb2');
  });
});
