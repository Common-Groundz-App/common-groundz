import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  session: { user: { id: 'owner-1' } } as any,
  sessionError: null as any,
  result: { data: null as any, error: null as any },
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {
    select: (...a: unknown[]) => (state.calls.push(['select', ...a]), builder),
    eq: (...a: unknown[]) => (state.calls.push(['eq', ...a]), builder),
    neq: (...a: unknown[]) => (state.calls.push(['neq', ...a]), builder),
    limit: () => builder,
    maybeSingle: async () => state.result,
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: state.session }, error: state.sessionError }) },
      from: (t: string) => (state.calls.push(['from', t]), builder),
    },
  };
});

import { findOwnReviewForEntity, isOwnReviewUniqueViolation } from '../ownReview';

const row = (visibility: string) => ({
  id: 'r1', entity_id: 'e1', user_id: 'owner-1', title: 'X', rating: 4,
  visibility, has_timeline: false, timeline_count: 0,
});

describe('findOwnReviewForEntity', () => {
  beforeEach(() => {
    state.session = { user: { id: 'owner-1' } };
    state.sessionError = null;
    state.result = { data: null, error: null };
    state.calls = [];
  });

  it.each(['public', 'circle_only', 'private'])('finds an owned %s review', async (v) => {
    state.result = { data: row(v), error: null };
    const r = await findOwnReviewForEntity('e1');
    expect(r).toEqual({ status: 'found', review: row(v) });
  });

  it('never filters by visibility and takes the owner from the session', async () => {
    await findOwnReviewForEntity('e1');
    const eqs = state.calls.filter((c) => c[0] === 'eq');
    expect(eqs).toEqual([['eq', 'user_id', 'owner-1'], ['eq', 'entity_id', 'e1']]);
  });

  it('returns none when nothing exists', async () => {
    expect(await findOwnReviewForEntity('e1')).toEqual({ status: 'none' });
  });

  it('returns error on a query failure, never none', async () => {
    state.result = { data: null, error: { message: 'boom' } };
    expect(await findOwnReviewForEntity('e1')).toEqual({ status: 'error' });
  });

  it('returns error without a session', async () => {
    state.session = null;
    expect(await findOwnReviewForEntity('e1')).toEqual({ status: 'error' });
  });

  it('excludes the review being edited', async () => {
    await findOwnReviewForEntity('e1', { excludeReviewId: 'r9' });
    expect(state.calls).toContainEqual(['neq', 'id', 'r9']);
  });
});

describe('isOwnReviewUniqueViolation', () => {
  it('matches only this rule', () => {
    expect(isOwnReviewUniqueViolation({ code: '23505', message: 'duplicate key value violates unique constraint "reviews_one_per_user_entity"' })).toBe(true);
    expect(isOwnReviewUniqueViolation({ code: '23505', message: 'duplicate key value violates unique constraint "reviews_pkey"' })).toBe(false);
    expect(isOwnReviewUniqueViolation({ code: '23503', message: 'reviews_one_per_user_entity' })).toBe(false);
    expect(isOwnReviewUniqueViolation(null)).toBe(false);
  });
});
