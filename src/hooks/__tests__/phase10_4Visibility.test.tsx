import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';

// Each `reviews` query resolves when the test says so, so we can make an
// older request finish after a newer one.
const pending: Array<{ resolve: (v: unknown) => void; filters: unknown[][] }> = [];
const makeBuilder = (table: string) => {
  const filters: unknown[][] = [];
  const b: any = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (res: any) => {
          if (table === 'reviews') pending.push({ resolve: res, filters });
          else if (table === 'review_updates') res({ data: [], error: null });
          else res({ data: null, error: null });
        };
      }
      return (...args: unknown[]) => { filters.push([prop, ...args]); return b; };
    },
  });
  return b;
};
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => makeBuilder(t) } }));

import { useEntityTimelineSummary } from '@/hooks/use-entity-timeline-summary';
import { REVIEWS_CHANGED_EVENT } from '@/services/review/reviewChangeEvents';

const row = (rating: number) => ({ data: [{ id: 'r' + rating, rating, created_at: '2026-01-01', has_timeline: true }], error: null });

describe('Entity timeline summary after a visibility change', () => {
  it('counts public reviews only', async () => {
    pending.length = 0;
    renderHook(() => useEntityTimelineSummary('e1'));
    await waitFor(() => expect(pending.length).toBe(1));
    expect(pending[0].filters).toContainEqual(['eq', 'visibility', 'public']);
  });

  it('refetches on review change and ignores an older late response', async () => {
    pending.length = 0;
    const { result } = renderHook(() => useEntityTimelineSummary('e1'));
    await waitFor(() => expect(pending.length).toBe(1));
    act(() => { window.dispatchEvent(new Event(REVIEWS_CHANGED_EVENT)); });
    await waitFor(() => expect(pending.length).toBe(2));
    await act(async () => { pending[1].resolve(row(2)); });
    await waitFor(() => expect(result.current.summary?.averageInitialRating).toBe(2));
    await act(async () => { pending[0].resolve(row(5)); });
    expect(result.current.summary?.averageInitialRating).toBe(2);
  });
});

describe('Trust Summary and refresh wiring', () => {
  const src = (p: string) => readFileSync(p, 'utf8');
  it('every Trust Metrics review query is public-only', () => {
    const s = src('src/hooks/useTrustMetrics.ts');
    const published = s.match(/\.eq\('status', 'published'\)/g)!.length;
    expect(s.match(/\.eq\('visibility', 'public'\)/g)!.length).toBe(published);
  });
  it('review changes refresh Trust Metrics', () => {
    expect(src('src/components/system/ReviewChangeInvalidationBridge.tsx')).toContain("queryKey: ['trust-metrics']");
  });
  it('Circle rating refetches on review change', () => {
    expect(src('src/hooks/use-circle-rating.ts')).toContain('REVIEWS_CHANGED_EVENT');
  });
});
