import { describe, expect, it } from 'vitest';
import {
  chunkTargetIds,
  collectTargetIds,
  getNotificationTargetRef,
  isRenderableImageUrl,
  resolveMediaItemThumbnail,
  resolvePostThumbnail,
  resolveRecommendationThumbnail,
} from './notificationThumbnail';

const POST_A = '11111111-1111-4111-8111-111111111111';
const POST_B = '22222222-2222-4222-8222-222222222222';
const REC_A = '33333333-3333-4333-8333-333333333333';

describe('isRenderableImageUrl', () => {
  it('accepts http(s) only', () => {
    expect(isRenderableImageUrl('https://cdn.test/a.jpg')).toBe(true);
    expect(isRenderableImageUrl('http://cdn.test/a.jpg')).toBe(true);
    expect(isRenderableImageUrl('data:image/png;base64,AAA')).toBe(false);
    expect(isRenderableImageUrl('blob:https://x/y')).toBe(false);
    expect(isRenderableImageUrl('/local/a.jpg')).toBe(false);
    expect(isRenderableImageUrl('')).toBe(false);
    expect(isRenderableImageUrl(null)).toBe(false);
    expect(isRenderableImageUrl(42)).toBe(false);
  });
});

describe('resolveMediaItemThumbnail', () => {
  it('resolves a plain image item', () => {
    expect(
      resolveMediaItemThumbnail({ url: 'https://cdn.test/a.jpg', type: 'image', order: 0 }),
    ).toBe('https://cdn.test/a.jpg');
  });

  it('skips deleted media', () => {
    expect(
      resolveMediaItemThumbnail({
        url: 'https://cdn.test/a.jpg',
        type: 'image',
        order: 0,
        is_deleted: true,
      }),
    ).toBeNull();
  });

  it('uses the mux thumbnail endpoint for a ready mux video', () => {
    const result = resolveMediaItemThumbnail({
      url: 'https://stream.mux.com/pb123.m3u8',
      type: 'video',
      order: 0,
      provider: 'mux',
      mux_status: 'ready',
      mux_playback_id: 'pb123',
    });
    expect(result).toBe('https://image.mux.com/pb123/thumbnail.jpg?width=160');
  });

  it('still posters a preparing mux video via playback id', () => {
    expect(
      resolveMediaItemThumbnail({
        url: 'x',
        type: 'video',
        order: 0,
        provider: 'mux',
        mux_status: 'preparing',
        mux_playback_id: 'pbAAA',
      }),
    ).toBe('https://image.mux.com/pbAAA/thumbnail.jpg?width=160');
  });

  it('never returns the raw video url for a mux item without playback id', () => {
    expect(
      resolveMediaItemThumbnail({
        url: 'https://cdn.test/movie.mp4',
        type: 'video',
        order: 0,
        provider: 'mux',
        mux_status: 'preparing',
      }),
    ).toBeNull();
  });

  it('never returns the raw video url for a legacy video without poster', () => {
    expect(
      resolveMediaItemThumbnail({ url: 'https://cdn.test/movie.mp4', type: 'video', order: 0 }),
    ).toBeNull();
  });

  it('uses the legacy video poster when present', () => {
    expect(
      resolveMediaItemThumbnail({
        url: 'https://cdn.test/movie.mp4',
        type: 'video',
        order: 0,
        thumbnail_url: 'https://cdn.test/poster.jpg',
      }),
    ).toBe('https://cdn.test/poster.jpg');
  });

  it('returns null for an errored mux item', () => {
    expect(
      resolveMediaItemThumbnail({
        url: 'x',
        type: 'video',
        order: 0,
        provider: 'mux',
        mux_status: 'errored',
        mux_playback_id: 'pb',
      }),
    ).toBeNull();
  });

  it('returns null for junk', () => {
    expect(resolveMediaItemThumbnail(null)).toBeNull();
    expect(resolveMediaItemThumbnail('nope')).toBeNull();
    expect(resolveMediaItemThumbnail({})).toBeNull();
  });
});

describe('resolvePostThumbnail', () => {
  it('picks the first renderable item by order', () => {
    expect(
      resolvePostThumbnail([
        { url: 'https://cdn.test/second.jpg', type: 'image', order: 2 },
        { url: 'https://cdn.test/first.jpg', type: 'image', order: 1 },
      ]),
    ).toBe('https://cdn.test/first.jpg');
  });

  it('skips deleted and unusable items before landing on a good one', () => {
    expect(
      resolvePostThumbnail([
        { url: 'https://cdn.test/gone.jpg', type: 'image', order: 0, is_deleted: true },
        { url: 'https://cdn.test/clip.mp4', type: 'video', order: 1 },
        { url: 'https://cdn.test/ok.jpg', type: 'image', order: 2 },
      ]),
    ).toBe('https://cdn.test/ok.jpg');
  });

  it('parses a stringified array', () => {
    expect(
      resolvePostThumbnail(JSON.stringify([{ url: 'https://cdn.test/a.jpg', type: 'image', order: 0 }])),
    ).toBe('https://cdn.test/a.jpg');
  });

  it('handles empty / malformed / missing jsonb', () => {
    expect(resolvePostThumbnail([])).toBeNull();
    expect(resolvePostThumbnail(null)).toBeNull();
    expect(resolvePostThumbnail(undefined)).toBeNull();
    expect(resolvePostThumbnail('{not json')).toBeNull();
    expect(resolvePostThumbnail({ url: 'https://cdn.test/a.jpg' })).toBeNull();
  });
});

describe('resolveRecommendationThumbnail', () => {
  it('accepts a valid image url and rejects the rest', () => {
    expect(resolveRecommendationThumbnail('https://cdn.test/r.jpg')).toBe('https://cdn.test/r.jpg');
    expect(resolveRecommendationThumbnail(null)).toBeNull();
    expect(resolveRecommendationThumbnail('')).toBeNull();
    expect(resolveRecommendationThumbnail('not-a-url')).toBeNull();
  });
});

describe('getNotificationTargetRef', () => {
  it('includes comment-scoped rows pointing at a parent post', () => {
    for (const type of ['like', 'comment', 'reply', 'mention', 'comment_like']) {
      expect(
        getNotificationTargetRef({ entity_type: 'post', entity_id: POST_A, type } as never),
      ).toEqual({ entityType: 'post', entityId: POST_A });
    }
  });

  it('includes recommendation targets', () => {
    expect(getNotificationTargetRef({ entity_type: 'recommendation', entity_id: REC_A })).toEqual({
      entityType: 'recommendation',
      entityId: REC_A,
    });
  });

  it('excludes follow rows, system rows and invalid ids', () => {
    expect(getNotificationTargetRef({ entity_type: 'profile', entity_id: POST_A })).toBeNull();
    expect(getNotificationTargetRef({ entity_type: 'post', entity_id: 'nope' })).toBeNull();
    expect(getNotificationTargetRef({ entity_type: null, entity_id: POST_A })).toBeNull();
    expect(getNotificationTargetRef({})).toBeNull();
    expect(getNotificationTargetRef(null)).toBeNull();
  });
});

describe('collectTargetIds', () => {
  it('dedupes across grouped rows and sorts for stable cache keys', () => {
    const result = collectTargetIds([
      { entity_type: 'post', entity_id: POST_B },
      { entity_type: 'post', entity_id: POST_A },
      { entity_type: 'post', entity_id: POST_B },
      { entity_type: 'recommendation', entity_id: REC_A },
      { entity_type: 'profile', entity_id: POST_A },
      null,
    ]);
    expect(result.post).toEqual([POST_A, POST_B]);
    expect(result.recommendation).toEqual([REC_A]);
  });

  it('returns empty buckets for no eligible rows', () => {
    expect(collectTargetIds([])).toEqual({ post: [], recommendation: [] });
  });
});

describe('chunkTargetIds', () => {
  it('issues no chunk for empty input', () => {
    expect(chunkTargetIds([])).toEqual([]);
  });

  it('keeps a single chunk at the 200 boundary and splits past it', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `id-${i}`);
    expect(chunkTargetIds(ids)).toHaveLength(1);
    expect(chunkTargetIds([...ids, 'id-200'])).toHaveLength(2);
    expect(chunkTargetIds([...ids, 'id-200'])[1]).toEqual(['id-200']);
  });

  it('preserves the given (sorted) order inside chunks', () => {
    expect(chunkTargetIds(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });
});
