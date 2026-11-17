import { describe, it, expect, vi, beforeEach } from 'vitest';

const state: { reviews: any[] } = { reviews: [] };

vi.mock('@/integrations/supabase/client', () => {
  const chain = (table: string) => {
    const q: any = {};
    ['select', 'eq', 'not', 'neq', 'in'].forEach((m) => { q[m] = () => q; });
    q.then = (res: any) => res({
      data: table === 'reviews' ? state.reviews : table === 'profiles' ? [] : [],
      error: null,
    });
    return q;
  };
  return { supabase: { from: (t: string) => chain(t) } };
});

import { fetchEntityReviewMedia } from '@/services/photoService';

const photo = (id: string) => ({ id, url: `https://x/${id}.jpg`, type: 'image', order: 0 });
const review = (id: string, metadata: unknown) => ({
  id, title: 't', created_at: '2026-01-01', user_id: 'u', metadata, media: [photo(`${id}-p`)],
});

describe('fetchEntityReviewMedia spoiler filtering', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

  it('excludes media from spoiler-marked reviews and keeps ordinary ones', async () => {
    state.reviews = [review('a', { contains_spoilers: true }), review('b', {}), review('c', null), review('d', { contains_spoilers: false })];
    const ids = (await fetchEntityReviewMedia('e')).map((p) => p.reviewId);
    expect(ids).toEqual(['b', 'c', 'd']);
  });

  it('only strict true hides media (malformed values stay visible)', async () => {
    state.reviews = [review('a', { contains_spoilers: 'true' })];
    expect(await fetchEntityReviewMedia('e')).toHaveLength(1);
  });

  it('follows the flag on/off without touching the stored media', async () => {
    const r = review('a', { contains_spoilers: false });
    const before = JSON.stringify(r);
    state.reviews = [r];
    expect(await fetchEntityReviewMedia('e')).toHaveLength(1);
    r.metadata = { contains_spoilers: true };
    expect(await fetchEntityReviewMedia('e')).toHaveLength(0);
    r.metadata = { contains_spoilers: false };
    expect(await fetchEntityReviewMedia('e')).toHaveLength(1);
    expect(JSON.stringify(r)).toBe(before);
  });
});
