import { describe, expect, it, vi } from 'vitest';
import { applyStableOrder, filterReviews, sortReviews } from '../reviewDataUtils';
import { chunkIds, fetchAllRowsPaged, ReviewDatasetIncompleteError } from '@/services/review/pagedFetch';

const r = (id: string, likes: number, created_at: string, extra: Record<string, unknown> = {}) =>
  ({ id, likes, created_at, rating: 3, user_id: 'u', user: { username: 'x' }, title: '', ...extra }) as any;

describe('Phase 11.4 Most Helpful ordering', () => {
  it('ranks Helpful DESC, then created_at DESC, then id DESC', () => {
    const rows = [
      r('a', 2, '2026-01-01'), r('b', 5, '2026-01-01'), r('c', 2, '2026-03-01'),
      r('d', 2, '2026-01-01'), r('e', 0, '2026-12-01'),
    ];
    expect(sortReviews(rows, 'mostHelpful').map(x => x.id)).toEqual(['b', 'c', 'd', 'a', 'e']);
  });
  it('rating sorts use the same deterministic tie-breakers', () => {
    const rows = [r('a', 0, '2026-01-01'), r('b', 0, '2026-02-01'), r('c', 0, '2026-01-01')];
    expect(sortReviews(rows, 'highestRated').map(x => x.id)).toEqual(['b', 'c', 'a']);
    expect(sortReviews(rows, 'lowestRated').map(x => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('Timeline format gives no ranking advantage', () => {
    const rows = [r('timeline', 0, '2026-05-01', { has_timeline: true, timeline_count: 4 }), r('standard', 50, '2026-01-01')];
    expect(filterReviews(rows, { sortBy: 'mostHelpful' }).map(x => x.id)).toEqual(['standard', 'timeline']);
  });
  it('Most Recent default order is unchanged by Helpful counts', () => {
    const rows = [r('old', 99, '2026-01-01'), r('new', 0, '2026-02-01')];
    expect(filterReviews(rows, { sortBy: 'mostRecent' }).map(x => x.id)).toEqual(['new', 'old']);
  });
});

describe('Phase 11.4 stable positions', () => {
  it('a vote that would re-rank keeps the previous positions', () => {
    const before = sortReviews([r('a', 3, '2026-01-01'), r('b', 2, '2026-01-01')], 'mostHelpful');
    const after = sortReviews([r('a', 3, '2026-01-01'), r('b', 4, '2026-01-01')], 'mostHelpful');
    expect(applyStableOrder(after, before.map(x => x.id)).map(x => x.id)).toEqual(['a', 'b']);
    expect(applyStableOrder(after, null).map(x => x.id)).toEqual(['b', 'a']);
  });
  it('reviews that become Private or deleted are removed immediately', () => {
    const now = [r('b', 1, '2026-01-01')];
    expect(applyStableOrder(now, ['a', 'b', 'c']).map(x => x.id)).toEqual(['b']);
  });
});

describe('Phase 11.4 complete paged retrieval', () => {
  const dataset = Array.from({ length: 7 }, (_, i) => ({ id: `r${i}` }));
  const pager = (rows: { id: string }[], count = rows.length) => vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null, count }));

  it('loads every page beyond the first response boundary', async () => {
    const page = pager(dataset);
    expect((await fetchAllRowsPaged(page, 3)).map(x => x.id)).toEqual(dataset.map(x => x.id));
    expect(page).toHaveBeenCalledTimes(3);
  });
  it('throws when an intermediate page fails', async () => {
    const page = vi.fn(async (from: number, to: number) => from === 3
      ? { data: null, error: new Error('boom'), count: null }
      : { data: dataset.slice(from, to + 1), error: null, count: 7 });
    await expect(fetchAllRowsPaged(page, 3)).rejects.toThrow('boom');
  });
  it('throws when rows change during retrieval or a gap appears', async () => {
    let calls = 0;
    const shifting = vi.fn(async (from: number, to: number) => ({ data: dataset.slice(from, to + 1), error: null, count: calls++ === 0 ? 7 : 8 }));
    await expect(fetchAllRowsPaged(shifting, 3)).rejects.toBeInstanceOf(ReviewDatasetIncompleteError);
    const duplicated = vi.fn(async (from: number) => ({ data: from === 3 ? dataset.slice(2, 5) : dataset.slice(from, from + 3), error: null, count: 7 }));
    await expect(fetchAllRowsPaged(duplicated, 3)).rejects.toBeInstanceOf(ReviewDatasetIncompleteError);
  });
  it('throws when completeness cannot be established (no count)', async () => {
    await expect(fetchAllRowsPaged(async () => ({ data: dataset, error: null, count: null }), 10)).rejects.toBeInstanceOf(ReviewDatasetIncompleteError);
  });
  it('chunks Helpful RPC ids into bounded batches', () => {
    expect(chunkIds(Array.from({ length: 450 }, (_, i) => i)).map(c => c.length)).toEqual([200, 200, 50]);
  });
});
