import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchReviewHelpfulState } from '../interactions';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

describe('Phase 11.4 batched Helpful counts', () => {
  beforeEach(() => rpc.mockReset());
  const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);
  it('enriches every id across batches', async () => {
    rpc.mockImplementation(async (_: string, args?: { p_review_ids: string[] }) =>
      ({ data: (args?.p_review_ids || []).map(id => ({ review_id: id, like_count: 1 })), error: null }));
    const out = await fetchReviewHelpfulState(ids, null);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(out.size).toBe(450);
    expect([...out.values()].every(v => v.count === 1)).toBe(true);
  });
  it('a failed batch rejects instead of reporting zero counts', async () => {
    let n = 0;
    rpc.mockImplementation(async () => (++n === 2 ? { data: null, error: new Error('rpc down') } : { data: [], error: null }));
    await expect(fetchReviewHelpfulState(ids, null)).rejects.toThrow('rpc down');
  });
});
