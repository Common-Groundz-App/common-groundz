import { describe, it, expect } from 'vitest';
import { mediaKey, findByMediaKey, ensureClientKey, reconcileComposerMedia } from '@/utils/mediaIdentity';
import { composerPreviewMedia } from '@/utils/composerVideoReadiness';
import type { MediaItem } from '@/types/media';

const v = (over: Partial<MediaItem>): MediaItem =>
  ({ url: 'u', type: 'video', order: 0, ...over } as MediaItem);

describe('Phase 4 Step 3 stable media identity', () => {
  it('mediaKey is null (never empty string) when id is missing', () => {
    expect(mediaKey(v({}))).toBeNull();
    expect(mediaKey(v({ id: '' }))).toBeNull();
    expect(mediaKey(v({ id: 'A' }))).toBe('A');
  });

  it('findByMediaKey returns -1 when the item is gone — never a positional fallback', () => {
    const list = [v({ id: 'A' }), v({ id: 'B' })];
    expect(findByMediaKey(list, 'B')).toBe(1);
    expect(findByMediaKey([list[1]], 'B')).toBe(0); // neighbour removed, still found
    expect(findByMediaKey(list, 'C')).toBe(-1);
    expect(findByMediaKey(list, null)).toBe(-1);
  });

  it('ensureClientKey generates once and never regenerates', () => {
    const a = ensureClientKey(v({ id: 'A' }));
    expect(a.clientKey).toBeTruthy();
    expect(ensureClientKey(a)).toBe(a);
  });

  it('server-ID adoption updates only id and keeps clientKey/order', () => {
    const local = ensureClientKey(v({ mux_upload_id: 'up1', order: 1 }));
    const [adopted] = reconcileComposerMedia([local], [v({ id: 'server', mux_upload_id: 'up1' })]);
    expect(adopted.id).toBe('server');
    expect(adopted.clientKey).toBe(local.clientKey);
    expect(adopted.order).toBe(1);
    expect(adopted.url).toBe('u');
  });

  it('adopts a changed server id for an id-less upload and keeps the same frozen preview', () => {
    const local = ensureClientKey(v({ mux_upload_id: 'up1' }));
    const frozen = new Map<string, MediaItem>();
    const has = (k: string) => k === local.clientKey;
    const before = composerPreviewMedia([local], [], has, frozen)[0];
    const [adopted] = reconcileComposerMedia([local], [v({ id: 'server', mux_upload_id: 'up1' })]);
    expect(adopted.id).toBe('server');
    expect(adopted.clientKey).toBe(local.clientKey);
    const after = composerPreviewMedia([adopted], [], has, frozen)[0];
    expect(after).toBe(before); // same player input object → no remount/reload
  });
});
