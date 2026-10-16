import { describe, it, expect } from 'vitest';
import { mergePlaceholderResult, newMuxVideoSaveBlocker } from '@/utils/composerVideoReadiness';
import type { MediaItem } from '@/types/media';

const ph = (ck: string, aid: string, order = 0): MediaItem => ({
  url: '', type: 'video', order, provider: 'mux', mux_status: 'preparing', clientKey: ck, uploadAttemptId: aid, width: 720, height: 1280,
});
const result = (ck: string, aid: string): MediaItem => ({
  id: 'srv', url: 'https://p.jpg', type: 'video', order: 0, provider: 'mux', mux_status: 'preparing', mux_upload_id: 'up_' + aid, clientKey: ck, uploadAttemptId: aid,
});

describe('Posts video placeholder merge', () => {
  it('enriches the exact item in place, keeping identity, order and dims', () => {
    const photo: MediaItem = { url: 'i.jpg', type: 'image', order: 0, clientKey: 'p' };
    const out = mergePlaceholderResult([photo, ph('A', 'a1', 1)], result('A', 'a1'));
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ clientKey: 'A', uploadAttemptId: 'a1', order: 1, mux_upload_id: 'up_a1', width: 720, height: 1280 });
    expect(out[0]).toBe(photo);
  });

  it('a late result from a removed attempt never touches the replacement', () => {
    const next = [ph('B', 'b1')];
    const out = mergePlaceholderResult(next, result('A', 'a1'));
    expect(out).toEqual(next);
  });

  it('same clientKey but an older attempt is ignored (retry)', () => {
    const out = mergePlaceholderResult([ph('A', 'a2')], result('A', 'a1'));
    expect(out[0].mux_upload_id).toBeUndefined();
  });

  it('never adds a second item', () => {
    expect(mergePlaceholderResult([], result('A', 'a1'))).toEqual([]);
  });

  it('publishing is blocked while the placeholder is unconfirmed', () => {
    expect(newMuxVideoSaveBlocker([ph('A', 'a1')], [], {})).toBeTruthy();
  });
});
