import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const result = { data: { id: 'r1' }, error: null };
  const chain: any = {};
  for (const m of ['insert', 'update', 'delete', 'eq', 'select']) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.then = (res: any) => Promise.resolve({ error: null }).then(res);
  return { chain, rpc: vi.fn(async () => ({ data: { status: 'deleted' }, error: null })) };
});
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => h.chain), rpc: h.rpc },
}));

import { REVIEWS_CHANGED_EVENT } from '../reviewChangeEvents';
import { createReview, updateReview, deleteReview, updateReviewStatus } from '../core';
import { addReviewUpdate, deleteLatestReviewUpdate } from '../timeline';

describe('review writes signal entity pages to refresh', () => {
  const listener = vi.fn();
  beforeEach(() => {
    listener.mockReset();
    (globalThis as any).window ??= new EventTarget();
    window.addEventListener(REVIEWS_CHANGED_EVENT, listener);
  });

  it.each([
    ['create', () => createReview({ entity_id: 'e', category: 'movie' } as any)],
    ['edit', () => updateReview('r1', { visibility: 'private' } as any)],
    ['delete', () => deleteReview('r1')],
    ['status', () => updateReviewStatus('r1', 'published')],
    ['timeline add', () => addReviewUpdate('r1', 'u1', 3, 'still ok')],
    ['timeline undo', () => deleteLatestReviewUpdate('r1', 'u1')],
  ])('%s', async (_n, run) => {
    await run();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(REVIEWS_CHANGED_EVENT, listener);
  });
});
