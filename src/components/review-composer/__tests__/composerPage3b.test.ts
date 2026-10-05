import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), auth: { getSession: vi.fn() } } }));

import { parsePublicFlags } from '@/hooks/useAppConfig';
import {
  REVIEW_COMPOSER_RELEASE_DEFAULT,
  resolveReviewComposerImplementation,
} from '@/hooks/useReviewComposerImplementation';
import { openExistingReviewTimelineUpdate, isRetryableOpenResult } from '../screen/openExistingReviewTimelineUpdate';
import { isUuid } from '../screen/loaders';
import { canUseReviewComposerPage, safeOrigin } from '@/pages/ReviewComposerPage';

describe('rollout switch (F6)', () => {
  it('release default is legacy', () => expect(REVIEW_COMPOSER_RELEASE_DEFAULT).toBe('legacy'));
  it('only an explicit true turns the flag on', () => {
    expect(parsePublicFlags({ reviews: { composer_page_enabled: true } }).reviews.composer_page_enabled).toBe(true);
    for (const v of [false, 'true', 1, null, undefined]) {
      expect(parsePublicFlags({ reviews: { composer_page_enabled: v } }).reviews.composer_page_enabled).toBe(false);
    }
    expect(parsePublicFlags(null).reviews.composer_page_enabled).toBe(false);
  });
  it('existing flags are parsed as before', () => {
    const f = parsePublicFlags({ mux: { mode: 'test' }, notifications: { realtime_enabled: false } });
    expect(f.mux).toEqual({ uploads_enabled: true, prewarm_enabled: true, mode: 'test' });
    expect(f.notifications.realtime_enabled).toBe(false);
  });
  it('loading, failure and placeholder always resolve to the release default', () => {
    expect(resolveReviewComposerImplementation({ status: 'pending', isPlaceholderData: false, enabled: true })).toBe('legacy');
    expect(resolveReviewComposerImplementation({ status: 'error', isPlaceholderData: false, enabled: true })).toBe('legacy');
    expect(resolveReviewComposerImplementation({ status: 'success', isPlaceholderData: true, enabled: true })).toBe('legacy');
    expect(resolveReviewComposerImplementation({ status: 'success', isPlaceholderData: false, enabled: false })).toBe('legacy');
    expect(resolveReviewComposerImplementation({ status: 'success', isPlaceholderData: false, enabled: true })).toBe('page');
  });
});

describe('temporary pre-cutover gate', () => {
  it('admins can test; others only when the switch is on', () => {
    expect(canUseReviewComposerPage('legacy', true)).toBe(true);
    expect(canUseReviewComposerPage('legacy', false)).toBe(false);
    expect(canUseReviewComposerPage('page', false)).toBe(true);
  });
});

describe('return destinations', () => {
  it('accepts only same-app paths', () => {
    expect(safeOrigin('/entity/toit')).toBe('/entity/toit');
    for (const bad of ['https://evil.com', '//evil.com', 'entity/x', '/review', '/review/abc/edit', 42, null]) {
      expect(safeOrigin(bad)).toBeNull();
    }
  });
  it('validates ids before any lookup', () => {
    expect(isUuid('7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('Add timeline update handoff', () => {
  const review = { id: 'r1', entity_id: 'e1', user_id: 'u1', title: 't', rating: 4, visibility: 'public', has_timeline: null, timeline_count: null };
  it('navigates to the stored-slug path with one-time state', async () => {
    const navigate = vi.fn();
    const r = await openExistingReviewTimelineUpdate(
      { entityId: 'e1', expectedReviewId: 'r1', navigate },
      async () => ({ status: 'found', review, canonicalPath: '/entity/toit' }),
    );
    expect(r).toEqual({ status: 'opened' });
    expect(navigate).toHaveBeenCalledWith('/entity/toit', { state: { openReviewUpdate: { reviewId: 'r1' } } });
  });
  it('never falls back to another review, an id URL or a query URL', async () => {
    const navigate = vi.fn();
    expect(
      await openExistingReviewTimelineUpdate({ entityId: 'e1', expectedReviewId: 'other', navigate }, async () => ({ status: 'found', review, canonicalPath: '/entity/toit' })),
    ).toEqual({ status: 'mismatch' });
    const noPath = await openExistingReviewTimelineUpdate({ entityId: 'e1', expectedReviewId: 'r1', navigate }, async () => ({ status: 'found', review, canonicalPath: null }));
    expect(noPath).toEqual({ status: 'no_destination' });
    expect(isRetryableOpenResult(noPath)).toBe(true);
    const failed = await openExistingReviewTimelineUpdate({ entityId: 'e1', expectedReviewId: 'r1', navigate }, async () => ({ status: 'error' }));
    expect(isRetryableOpenResult(failed)).toBe(true);
    expect(await openExistingReviewTimelineUpdate({ entityId: 'e1', expectedReviewId: 'r1', navigate }, async () => ({ status: 'none' }))).toEqual({ status: 'not_found' });
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('3B boundaries', () => {
  const ROOT = join(__dirname, '../../..');
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(t|j)sx?$/.test(n) ? [p] : [];
    });
  it('no existing entry point links to the new page yet', () => {
    const offenders = walk(ROOT)
      .filter((f) => !/review-composer|ReviewComposerPage|App\.tsx$/.test(f))
      .filter((f) => /ReviewComposerPage|['"`]\/review(\?|['"`/])/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
  it('the page never imports the legacy popup orchestration', () => {
    const files = [join(ROOT, 'pages/ReviewComposerPage.tsx'), ...walk(join(ROOT, 'components/review-composer/screen'))];
    for (const f of files) expect(readFileSync(f, 'utf8')).not.toMatch(/reviews\/ReviewForm['"]|ReviewTimelineViewer/);
  });
});
