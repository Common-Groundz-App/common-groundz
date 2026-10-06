import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIALOG_COPY,
  createKeyWaiter,
  decideOnBase,
  guardSessionOf,
  shouldArm,
  withGuard,
  withoutGuard,
} from '../screen/historyGuard';
import {
  __resetRegistry,
  decideFinishedUpload,
  endSession,
  getOrphans,
  hasSession,
  releaseSlot,
  reserveSlots,
  setSettlement,
  syncCommitted,
} from '../uploadRegistry';
import { shouldShowLocationPrompt, LAST_SHOWN_KEY, LAST_SKIPPED_KEY } from '../screen/locationPromptPolicy';
import { composerReducer, initialComposerState } from '../store';
import type { MediaItem } from '@/types/media';

const img = (url: string): MediaItem => ({ url, type: 'image', order: 0 });

describe('history guard (pure)', () => {
  it('keeps router state and adds only the marker', () => {
    const s = withGuard({ from: '/home', other: 1 }, 's1');
    expect(s).toMatchObject({ from: '/home', other: 1 });
    expect(guardSessionOf(s)).toBe('s1');
    expect(withoutGuard(s)).toEqual({ from: '/home', other: 1 });
    expect(guardSessionOf(null)).toBeNull();
  });
  it('arms at most once and only when something can be lost', () => {
    expect(shouldArm('clean', null, 's1', false)).toBe(false);
    expect(shouldArm('dirty', null, 's1', false)).toBe(true);
    expect(shouldArm('dirty', null, 's1', true)).toBe(false);
    expect(shouldArm('saving', withGuard(null, 's1'), 's1', false)).toBe(false);
    // leftover marker from another session doesn't count as ours
    expect(shouldArm('ambiguous', withGuard(null, 'old'), 's1', false)).toBe(true);
  });
  it('decides Back from the guard', () => {
    expect(decideOnBase('dirty', false)).toEqual({ kind: 'block', mode: 'dirty' });
    expect(decideOnBase('saving', true)).toEqual({ kind: 'block', mode: 'saving' });
    expect(decideOnBase('ambiguous', true)).toEqual({ kind: 'block', mode: 'ambiguous' });
    expect(decideOnBase('clean', true)).toEqual({ kind: 'release-back' });
    expect(decideOnBase('clean', false)).toEqual({ kind: 'release-replace' });
  });
  it('uses distinct copy for saving and ambiguous', () => {
    expect(DIALOG_COPY.dirty).toMatchObject({ title: 'Discard your draft?', confirm: 'Discard', cancel: 'Keep editing' });
    expect(DIALOG_COPY.saving.description).toBe('Your review is still saving. Leaving now may leave its status uncertain.');
    expect(DIALOG_COPY.ambiguous.description).toMatch(/^We couldn't confirm whether your review was saved/);
    expect(DIALOG_COPY.saving.confirm).toBe('Leave anyway');
    expect(DIALOG_COPY.ambiguous.cancel).toBe('Stay here');
  });
  it('waiter: arrived, unexpected, timeout, aborted', async () => {
    vi.useFakeTimers();
    const w = createKeyWaiter();
    const a = w.wait('base');
    w.notify('base');
    await expect(a).resolves.toBe('arrived');
    const b = w.wait('base');
    w.notify('other');
    await expect(b).resolves.toBe('unexpected');
    const c = w.wait('base', 1000);
    vi.advanceTimersByTime(1001);
    await expect(c).resolves.toBe('timeout');
    const d = w.wait('base');
    w.abort();
    await expect(d).resolves.toBe('aborted');
    vi.useRealTimers();
  });
});

describe('upload registry', () => {
  beforeEach(() => __resetRegistry());
  it('reserves slots atomically across quick selections', () => {
    syncCommitted('s', 3);
    expect(reserveSlots('s', 2)).toBe(1);
    expect(reserveSlots('s', 1)).toBe(0); // second selection can't take the last slot
    releaseSlot('s');
    expect(reserveSlots('s', 1)).toBe(1);
  });
  it('adds while open and live; over the limit is deleted', () => {
    syncCommitted('s', 3);
    reserveSlots('s', 1);
    expect(decideFinishedUpload('s', 'a', true)).toBe('add');
    releaseSlot('s');
    expect(decideFinishedUpload('s', 'b', true)).toBe('delete');
  });
  it('late finish: open session left → delete; saving/ambiguous left → orphan kept', () => {
    reserveSlots('open', 1);
    endSession('open');
    expect(hasSession('open')).toBe(true); // still pending
    expect(decideFinishedUpload('open', 'x', false)).toBe('delete');
    releaseSlot('open');
    expect(hasSession('open')).toBe(false); // removed once settled

    for (const st of ['saving', 'ambiguous'] as const) {
      const id = `s-${st}`;
      reserveSlots(id, 1);
      setSettlement(id, st);
      endSession(id);
      expect(decideFinishedUpload(id, 'y', false)).toBe('keep-orphan');
      expect(getOrphans(id)).toEqual(['y']);
      releaseSlot(id);
      expect(hasSession(id)).toBe(false);
    }
  });
  it('an ended session with pending uploads grants no new slots', () => {
    reserveSlots('e', 1);
    endSession('e');
    expect(reserveSlots('e', 1)).toBe(0);
  });
});

describe('location prompt policy', () => {
  const store = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };
  const base = { locationEnabled: false, permissionStatus: 'prompt', now: 10 * 3600_000 };
  it('follows eligibility and the 24h / 2h rules', () => {
    expect(shouldShowLocationPrompt({ ...base, eligible: false, storage: store() })).toBe(false);
    expect(shouldShowLocationPrompt({ ...base, eligible: true, storage: store() })).toBe(true);
    expect(shouldShowLocationPrompt({ ...base, eligible: true, permissionStatus: 'granted', storage: store() })).toBe(false);
    expect(shouldShowLocationPrompt({ ...base, eligible: true, storage: store({ [LAST_SHOWN_KEY]: String(base.now - 3600_000) }) })).toBe(false);
    expect(shouldShowLocationPrompt({ ...base, eligible: true, storage: store({ [LAST_SKIPPED_KEY]: String(base.now - 3 * 3600_000) }) })).toBe(true);
    expect(shouldShowLocationPrompt({ ...base, eligible: true, storage: store({ [LAST_SKIPPED_KEY]: String(base.now - 3600_000) }) })).toBe(false);
  });
});

describe('MEDIA_ADDED / MEDIA_REMOVED', () => {
  const start = () => initialComposerState({ sessionKey: 'k1', mode: 'create-review' });
  it('applies several finishes against the latest state', () => {
    let s = start();
    const k = s.sessionKey;
    for (const u of ['a', 'b', 'c']) s = composerReducer(s, { type: 'MEDIA_ADDED', sessionKey: k, media: img(u) });
    expect(s.values.media.map((m) => [m.url, m.order])).toEqual([['a', 0], ['b', 1], ['c', 2]]);
  });
  it('skips duplicates, caps at 4, renumbers on remove, ignores stale sessions', () => {
    let s = start();
    const k = s.sessionKey;
    for (const u of ['a', 'a', 'b', 'c', 'd', 'e']) s = composerReducer(s, { type: 'MEDIA_ADDED', sessionKey: k, media: img(u) });
    expect(s.values.media.map((m) => m.url)).toEqual(['a', 'b', 'c', 'd']);
    s = composerReducer(s, { type: 'MEDIA_REMOVED', sessionKey: k, url: 'b' });
    expect(s.values.media.map((m) => [m.url, m.order])).toEqual([['a', 0], ['c', 1], ['d', 2]]);
    s = composerReducer(s, { type: 'MEDIA_ADDED', sessionKey: k, media: img('f') });
    expect(s.values.media).toHaveLength(4);
    const stale = composerReducer(s, { type: 'MEDIA_ADDED', sessionKey: 'old', media: img('z') });
    expect(stale).toBe(s);
  });
});
