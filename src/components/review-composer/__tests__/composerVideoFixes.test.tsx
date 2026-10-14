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
