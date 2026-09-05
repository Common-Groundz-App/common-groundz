import { describe, expect, it, vi } from 'vitest';

import { supabase } from '@/integrations/supabase/client';
import {
  addReviewUpdate,
  deleteLatestReviewUpdate,
  fetchLatestRecommendationIntent,
  type WouldRecommendValue,
} from '../timeline';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const mockFrom = vi.mocked(supabase.from);
const mockRpc = vi.mocked(supabase.rpc);

function createMockChain() {
  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  };
  return chain;
}

describe('addReviewUpdate payload semantics', () => {
  it('omits would_recommend when the value is null or undefined (skip)', () => {
    const chain = createMockChain();
    chain.insert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain as any);

    for (const value of [undefined, null] as (WouldRecommendValue | undefined)[]) {
      void addReviewUpdate('review-1', 'user-1', 5, 'Great', [], value as WouldRecommendValue);
      const payload = chain.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(payload).toHaveProperty('review_id');
      expect(payload).not.toHaveProperty('would_recommend');
    }
  });

  it('writes explicit yes/maybe/no values literally', () => {
    const chain = createMockChain();
    chain.insert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain as any);

    const cases: WouldRecommendValue[] = ['yes', 'maybe', 'no'];
    for (const value of cases) {
      void addReviewUpdate('review-1', 'user-1', 5, 'Great', [], value);
      const payload = chain.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(payload.would_recommend).toBe(value);
    }
  });

  it('writes auto for the "Base recommendation on rating" reset action', () => {
    const chain = createMockChain();
    chain.insert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain as any);

    void addReviewUpdate('review-1', 'user-1', 5, 'Resetting', [], 'auto');
    const payload = chain.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(payload.would_recommend).toBe('auto');
  });
});

describe('fetchLatestRecommendationIntent', () => {
  it('returns found when a non-null intent row exists', async () => {
    const chain = createMockChain();
    const event = { id: 'upd-1', would_recommend: 'yes' };
    chain.maybeSingle.mockResolvedValue({ data: event, error: null });
    mockFrom.mockReturnValue(chain as any);

    const result = await fetchLatestRecommendationIntent('review-1');
    expect(result).toEqual({ status: 'found', event });
  });

  it('returns none when no intent rows exist', async () => {
    const chain = createMockChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain as any);

    const result = await fetchLatestRecommendationIntent('review-1');
    expect(result).toEqual({ status: 'none' });
  });

  it('returns error on query failure', async () => {
    const chain = createMockChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValue(chain as any);

    const result = await fetchLatestRecommendationIntent('review-1');
    expect(result).toEqual({ status: 'error' });
  });
});

describe('deleteLatestReviewUpdate status mapping', () => {
  it('maps deleted, conflict, and not_found statuses exactly', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'deleted' }, error: null });
    expect(await deleteLatestReviewUpdate('review-1', 'upd-1')).toBe('deleted');

    mockRpc.mockResolvedValue({ data: { status: 'conflict' }, error: null });
    expect(await deleteLatestReviewUpdate('review-1', 'upd-1')).toBe('conflict');

    mockRpc.mockResolvedValue({ data: { status: 'not_found' }, error: null });
    expect(await deleteLatestReviewUpdate('review-1', 'upd-1')).toBe('not_found');
  });

  it('treats unexpected RPC payloads and RPC errors as error', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'weird' }, error: null });
    expect(await deleteLatestReviewUpdate('review-1', 'upd-1')).toBe('error');

    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await deleteLatestReviewUpdate('review-1', 'upd-1')).toBe('error');
  });
});
