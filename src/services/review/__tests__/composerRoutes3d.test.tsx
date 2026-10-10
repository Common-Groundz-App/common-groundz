import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { composerPath, resolveComposerTarget, type ComposerAction } from '../composerRoutes';

const impl = { implementation: 'legacy' as 'legacy' | 'page', isResolved: false };
vi.mock('@/hooks/useReviewComposerImplementation', () => ({
  useReviewComposerImplementation: () => impl,
}));
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const m: any = await orig();
  return { ...m, useNavigate: () => navigateSpy };
});
import { useReviewComposerNavigate } from '@/hooks/useReviewComposerNavigate';

const R = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const U = '11111111-2222-4333-8444-555555555555';
const E = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const actions: [ComposerAction, string][] = [
  [{ kind: 'write' }, '/review'],
  [{ kind: 'write', entityId: E }, `/review?entityId=${E}`],
  [{ kind: 'editReview', reviewId: R }, `/review/${R}/edit`],
  [{ kind: 'addUpdate', reviewId: R }, `/review/${R}/timeline/new`],
  [{ kind: 'editUpdate', reviewId: R, updateId: U }, `/review/${R}/timeline/${U}/edit`],
];

describe('resolveComposerTarget', () => {
  it.each(actions)('ID-based page address for %o when on; legacy when off', (a, path) => {
    expect(composerPath(a)).toBe(path);
    expect(resolveComposerTarget(a, 'page', '/entity/toit')).toEqual({ to: path, state: { from: '/entity/toit' } });
    expect(resolveComposerTarget(a, 'legacy', '/entity/toit')).toBe('legacy');
  });
  it('drops unsafe origins', () => {
    expect(resolveComposerTarget({ kind: 'write' }, 'page', 'https://evil.com')).toEqual({ to: '/review', state: {} });
    expect(resolveComposerTarget({ kind: 'write' }, 'page', '/review/x/edit')).toEqual({ to: '/review', state: {} });
  });
});

describe('useReviewComposerNavigate', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    impl.implementation = 'legacy';
    impl.isResolved = false;
  });
  const wrap = ({ children }: { children: React.ReactNode }) => <MemoryRouter initialEntries={['/entity/toit']}>{children}</MemoryRouter>;

  it('on → navigates once with origin; legacy never runs', () => {
    impl.implementation = 'page'; impl.isResolved = true;
    const legacy = vi.fn();
    const { result } = renderHook(() => useReviewComposerNavigate(), { wrapper: wrap });
    act(() => result.current.open({ kind: 'editReview', reviewId: R }, legacy));
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(`/review/${R}/edit`, { state: { from: '/entity/toit' } });
    expect(legacy).not.toHaveBeenCalled();
  });
  it('off → legacy once, no navigation', () => {
    impl.isResolved = true;
    const legacy = vi.fn();
    const { result } = renderHook(() => useReviewComposerNavigate(), { wrapper: wrap });
    act(() => result.current.open({ kind: 'write' }, legacy));
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
  it('loading → one pending tap, extra taps ignored, runs once when resolved on', () => {
    const legacy = vi.fn();
    const { result, rerender } = renderHook(() => useReviewComposerNavigate(), { wrapper: wrap });
    act(() => result.current.open({ kind: 'addUpdate', reviewId: R }, legacy));
    act(() => result.current.open({ kind: 'addUpdate', reviewId: R }, legacy));
    expect(result.current.isPending).toBe(true);
    impl.implementation = 'page'; impl.isResolved = true;
    rerender();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(legacy).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });
  it('loading then failure (legacy) → legacy runs once', () => {
    const legacy = vi.fn();
    const { result, rerender } = renderHook(() => useReviewComposerNavigate(), { wrapper: wrap });
    act(() => result.current.open({ kind: 'write' }, legacy));
    impl.isResolved = true; // failure resolves to the legacy release default
    rerender();
    rerender();
    expect(legacy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
  it('a waiting tap is cancelled on unmount or when the target changes', () => {
    const legacy = vi.fn();
    const { result, rerender, unmount } = renderHook(() => useReviewComposerNavigate(), { wrapper: wrap });
    act(() => result.current.open({ kind: 'addUpdate', reviewId: R }, legacy));
    act(() => result.current.open({ kind: 'addUpdate', reviewId: U }, legacy)); // different target
    expect(result.current.isPending).toBe(false);
    act(() => result.current.open({ kind: 'write' }, legacy));
    unmount();
    impl.isResolved = true;
    expect(legacy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    void rerender;
  });
});

describe('entry-point inventory uses the helper', () => {
  const ROOT = join(__dirname, '../../..');
  const files = [
    'components/feed/SmartComposerButton.tsx',
    'components/entity-v4/EntityV4.tsx',
    'components/reviews/ReviewOwnerMenu.tsx',
    'components/profile/ProfileReviews.tsx',
    'components/profile/reviews/ReviewTimelineViewer.tsx',
  ];
  it.each(files)('%s routes through useReviewComposerNavigate', (f) => {
    expect(readFileSync(join(ROOT, f), 'utf8')).toMatch(/useReviewComposerNavigate/);
  });
  it('timeline viewer Add/Edit go through the helper, with the inline form as the legacy action', () => {
    const s = readFileSync(join(ROOT, 'components/profile/reviews/ReviewTimelineViewer.tsx'), 'utf8');
    expect(s).toMatch(/composer\.open\(\{ kind: 'addUpdate', reviewId \}, \(\) => setIsAddingUpdate\(true\)\)/);
    expect(s).toMatch(/composer\.open\(\{ kind: 'editUpdate', reviewId, updateId: update\.id \}, \(\) => startEditUpdate\(update\)\)/);
    expect(s).not.toMatch(/onClick=\{\(\) => setIsAddingUpdate\(true\)\}/);
  });
  it('?compose=update has page and legacy branches', () => {
    const s = readFileSync(join(ROOT, 'components/entity-v4/EntityV4.tsx'), 'utf8');
    expect(s).toMatch(/kind: 'addUpdate', reviewId: userReview\.id/);
  });
});
