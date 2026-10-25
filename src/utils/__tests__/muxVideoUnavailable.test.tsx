import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isMuxVideoUnavailable } from '../muxVideoUnavailable';
import { useUnavailableComposerVideo } from '@/hooks/useUnavailableComposerVideo';
import type { MediaItem } from '@/types/media';

describe('attachment-barrier error recognition', () => {
  it('recognizes only the known signal or detail, including wrapped causes', () => {
    expect(isMuxVideoUnavailable({ code: 'P0001', message: 'video_unavailable' })).toBe(true);
    expect(isMuxVideoUnavailable({ cause: { details: 'mux asset has been removed' } })).toBe(true);
    for (const error of [{ code: 'P0001', message: 'review_edit_window_closed' }, { message: 'Network error' }, { message: 'not_video_unavailable' }, { details: 'unavailable' }]) {
      expect(isMuxVideoUnavailable(error)).toBe(false);
    }
    const circular: any = {}; circular.cause = circular;
    expect(isMuxVideoUnavailable(circular)).toBe(false);
  });
  it('blocks the exact rejected upload across unrelated renders, not its replacement or photos', () => {
    const a: MediaItem = { type: 'video', provider: 'mux', mux_upload_id: 'A', clientKey: 'local-A', url: 'blob:A', order: 0 };
    const photo: MediaItem = { type: 'image', url: 'kept.jpg', order: 1 };
    const { result, rerender } = renderHook(({ media }) => useUnavailableComposerVideo(media), { initialProps: { media: [a, photo] } });
    act(() => { result.current.handleError({ message: 'video_unavailable' }); });
    expect(result.current.blocked).toBe(true);
    rerender({ media: [{ ...a, caption: 'unrelated edit', mux_status: 'ready' }, photo] });
    expect(result.current.blocked).toBe(true);
    expect(result.current.isUnavailable(photo)).toBe(false);
    rerender({ media: [{ ...a, mux_upload_id: 'B' }, photo] });
    expect(result.current.blocked).toBe(false);
    rerender({ media: [a, photo] });
    expect(result.current.blocked).toBe(true);
    rerender({ media: [photo] });
    expect(result.current.blocked).toBe(false);
  });
});