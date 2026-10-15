import { describe, it, expect } from 'vitest';
import { getPostDisplayMedia } from '@/utils/postDisplayMedia';
import { findByMediaKey } from '@/utils/mediaIdentity';
import type { MediaItem } from '@/types/media';

const m = (id: string, type: 'image' | 'video', order: number): MediaItem =>
  ({ id, type, order, url: id } as MediaItem);

describe('getPostDisplayMedia', () => {
  it('puts the video first and keeps the rest in saved order', () => {
    const saved = [m('i1', 'image', 0), m('i2', 'image', 1), m('v', 'video', 2)];
    expect(getPostDisplayMedia(saved).map((x) => x.id)).toEqual(['v', 'i1', 'i2']);
  });

  it('does not mutate the saved array or items', () => {
    const saved = [m('i1', 'image', 0), m('v', 'video', 1)];
    const snapshot = JSON.stringify(saved);
    const out = getPostDisplayMedia(saved);
    expect(JSON.stringify(saved)).toBe(snapshot);
    expect(out[0]).toBe(saved[1]);
    expect(out[0].order).toBe(1);
  });

  it('feed position and lightbox position agree (video shows as 1/2)', () => {
    const display = getPostDisplayMedia([m('i1', 'image', 0), m('v', 'video', 1)]);
    expect(findByMediaKey(display, 'v')).toBe(0);
  });

  it('leaves single and image-only media unchanged', () => {
    const imgs = [m('a', 'image', 0), m('b', 'image', 1)];
    expect(getPostDisplayMedia(imgs).map((x) => x.id)).toEqual(['a', 'b']);
    expect(getPostDisplayMedia([m('v', 'video', 0)]).map((x) => x.id)).toEqual(['v']);
  });
});
