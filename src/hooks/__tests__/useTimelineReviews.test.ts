import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let resolveFetch: (v: any[]) => void = () => {};
vi.mock('@/services/review/timeline', () => ({
  fetchReviewUpdates: vi.fn(() => new Promise((r) => { resolveFetch = r; })),
}));

import { useTimelineReviews } from '../useTimelineReviews';

const review = { id: 'r1', has_timeline: true, timeline_count: 1 } as any;

describe('useTimelineReviews', () => {
  it('clears entries and ignores a late answer after the review is removed', async () => {
    const { result, rerender } = renderHook(({ reviews }) => useTimelineReviews(reviews), {
      initialProps: { reviews: [review] },
    });
    expect(result.current.has('r1')).toBe(true);
    rerender({ reviews: [] });
    expect(result.current.size).toBe(0);
    await act(async () => {
      resolveFetch([{ id: 'u1' }]);
      await Promise.resolve();
    });
    expect(result.current.has('r1')).toBe(false);
  });
});
