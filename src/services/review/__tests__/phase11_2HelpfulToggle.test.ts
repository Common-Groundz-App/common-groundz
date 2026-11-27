import { describe, it, expect, vi } from 'vitest';
import { performHelpfulToggle, HelpfulSnapshot, HelpfulToggleDeps } from '../helpfulToggle';

function setup(overrides: Partial<HelpfulToggleDeps> = {}, start: HelpfulSnapshot = { likes: 10, isLiked: false }) {
  let state: HelpfulSnapshot | null = { ...start };
  let viewer: string | null = 'u1';
  const deps: HelpfulToggleDeps = {
    reviewId: 'r1',
    viewerId: 'u1',
    getCurrentViewerId: () => viewer,
    pending: new Set(),
    cancelReads: vi.fn(async () => {}),
    read: () => state,
    write: (n) => { state = { ...n }; },
    toggle: vi.fn(async () => ({ success: true as const, isLiked: true })),
    fetchState: vi.fn(async () => new Map([['r1', { count: 11, isLiked: true }]])),
    invalidate: vi.fn(),
    notifyError: vi.fn(),
    ...overrides,
  };
  return { deps, get: () => state, setViewer: (v: string | null) => { viewer = v; } };
}

describe('Phase 11.2 Helpful toggle', () => {
  it('confirmed vote uses server selection and authoritative count', async () => {
    const t = setup({ fetchState: vi.fn(async () => new Map([['r1', { count: 12, isLiked: true }]])) });
    expect(await performHelpfulToggle(t.deps)).toBe('confirmed');
    expect(t.get()).toEqual({ likes: 12, isLiked: true });
    expect(t.deps.cancelReads).toHaveBeenCalled();
  });

  it('confirmed unvote is distinct from failure', async () => {
    const t = setup({
      toggle: vi.fn(async () => ({ success: true as const, isLiked: false })),
      fetchState: vi.fn(async () => new Map([['r1', { count: 9, isLiked: false }]])),
    }, { likes: 10, isLiked: true });
    expect(await performHelpfulToggle(t.deps)).toBe('confirmed');
    expect(t.get()).toEqual({ likes: 9, isLiked: false });
    expect(t.deps.notifyError).not.toHaveBeenCalled();
  });

  it('confirmed rejection restores the previous state and toasts', async () => {
    const t = setup({ toggle: vi.fn(async () => ({ success: false as const, error: 'self', ambiguous: false })) });
    expect(await performHelpfulToggle(t.deps)).toBe('rejected');
    expect(t.get()).toEqual({ likes: 10, isLiked: false });
    expect(t.deps.notifyError).toHaveBeenCalledWith('rejected');
  });

  it('ambiguous timeout reconciles by reading and never re-toggles', async () => {
    const t = setup({ toggle: vi.fn(async () => ({ success: false as const, error: 'timeout', ambiguous: true })) });
    expect(await performHelpfulToggle(t.deps)).toBe('reconciled');
    expect(t.deps.toggle).toHaveBeenCalledTimes(1);
    expect(t.get()).toEqual({ likes: 11, isLiked: true });
    expect(t.deps.notifyError).not.toHaveBeenCalled();
  });

  it('ambiguous timeout with failed read restores, invalidates and warns', async () => {
    const t = setup({
      toggle: vi.fn(async () => ({ success: false as const, error: 'timeout', ambiguous: true })),
      fetchState: vi.fn(async () => { throw new Error('offline'); }),
    });
    expect(await performHelpfulToggle(t.deps)).toBe('unconfirmed');
    expect(t.deps.toggle).toHaveBeenCalledTimes(1);
    expect(t.get()).toEqual({ likes: 10, isLiked: false });
    expect(t.deps.invalidate).toHaveBeenCalled();
    expect(t.deps.notifyError).toHaveBeenCalledWith('unconfirmed');
  });

  it('a second tap while pending is ignored', async () => {
    let release!: () => void;
    const t = setup({
      toggle: vi.fn(() => new Promise<any>((res) => { release = () => res({ success: true, isLiked: true }); })),
    });
    const first = performHelpfulToggle(t.deps);
    expect(await performHelpfulToggle(t.deps)).toBe('skipped_pending');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await first;
    expect(t.deps.toggle).toHaveBeenCalledTimes(1);
    expect(t.deps.pending.size).toBe(0);
  });

  it('account switch during voting drops the late response', async () => {
    let release!: () => void;
    const t = setup({
      toggle: vi.fn(() => new Promise<any>((res) => { release = () => res({ success: true, isLiked: true }); })),
    });
    const run = performHelpfulToggle(t.deps);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const afterOptimistic = t.get();
    t.setViewer('u2');
    release();
    expect(await run).toBe('viewer_changed');
    expect(t.get()).toEqual(afterOptimistic);
    expect(t.deps.fetchState).not.toHaveBeenCalled();
  });
});
