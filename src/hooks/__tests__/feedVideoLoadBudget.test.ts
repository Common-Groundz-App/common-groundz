import { describe, it, expect } from 'vitest';
import {
  selectFeedVideoLoadSet,
  FEED_VIDEO_LOAD_GRACE_MS,
  type LoadSlotGeometry,
} from '@/hooks/feedVideoLoadBudget';

const VP = 800;
const g = (id: string, distance: number, ahead = false): LoadSlotGeometry => ({ id, distance, ahead });

function run(opts: Partial<Parameters<typeof selectFeedVideoLoadSet>[0]> & { slots: LoadSlotGeometry[] }) {
  return selectFeedVideoLoadSet({
    activeId: null,
    pinned: new Set(),
    prevAllowed: new Set(),
    graceUntil: new Map(),
    now: 1000,
    viewportHeight: VP,
    lightboxOpen: false,
    ...opts,
  });
}

describe('feed video loading budget', () => {
  it('never allows more than two attached slots, even with many nearby videos', () => {
    const slots = ['a', 'b', 'c', 'd', 'e'].map((id, i) => g(id, i * 50));
    const set = run({ slots, activeId: 'c' });
    expect(set.size).toBe(2);
    expect(set.has('c')).toBe(true);
    expect(set.has('a')).toBe(true); // nearest eligible
  });

  it('far-offscreen slots are poster-only', () => {
    const set = run({ slots: [g('a', 0), g('far', VP * 3)], activeId: 'a' });
    expect([...set]).toEqual(['a']);
  });

  it('upcoming slot wins the single preload seat; nearest is the fallback', () => {
    const s = run({ slots: [g('cur', 0), g('passed', 100), g('next', 300, true)], activeId: 'cur' });
    expect([...s].sort()).toEqual(['cur', 'next']);
    const noAhead = run({ slots: [g('cur', 0), g('a', 100), g('b', 300)], activeId: 'cur' });
    expect([...noAhead].sort()).toEqual(['a', 'cur']);
  });

  it('upcoming preempts a passed grace slot without exceeding the cap', () => {
    const grace = new Map<string, number>();
    const s = run({ slots: [g('p1', 50), g('p2', 0), g('p3', 200, true)], activeId: 'p2', prevAllowed: new Set(['p1', 'p2']), graceUntil: grace });
    expect([...s].sort()).toEqual(['p2', 'p3']);
  });

  it('active slot keeps its seat regardless of playback (budget has no playing input)', () => {
    const s = run({ slots: [g('paused', 0), g('n', 10, true), g('m', 20, true)], activeId: 'paused' });
    expect(s.has('paused')).toBe(true);
    expect(s.size).toBe(2);
  });

  it('identity is by stable id, not input order', () => {
    const a = run({ slots: [g('x', 10), g('y', 10), g('z', 10)] });
    const b = run({ slots: [g('z', 10), g('y', 10), g('x', 10)] });
    expect([...a].sort()).toEqual([...b].sort());
  });

  it('live handoff pin preempts speculative preload and lightbox suspends preload', () => {
    const slots = [g('pin', VP * 4), g('near1', 0), g('near2', 10)];
    const open = run({ slots, pinned: new Set(['pin']), lightboxOpen: true });
    expect([...open]).toEqual(['pin']);
    const closed = run({ slots, pinned: new Set(['pin']), activeId: 'near1' });
    expect([...closed].sort()).toEqual(['near1', 'pin']);
  });

  it('grace-retained slots count toward the budget, are preempted by required slots, and expire', () => {
    const grace = new Map<string, number>();
    const slots = [g('old', VP * 3), g('act', 0), g('near', 20)];
    const s1 = run({ slots, activeId: 'act', prevAllowed: new Set(['old', 'act']), graceUntil: grace });
    expect([...s1].sort()).toEqual(['act', 'old']); // grace holds the 2nd seat
    expect(grace.has('old')).toBe(true);
    // Rebound during grace: becomes desired again, grace cleared.
    const s2 = run({ slots: [g('old', 0), g('act', 0)], activeId: 'act', prevAllowed: s1, graceUntil: grace });
    expect(s2.has('old')).toBe(true);
    expect(grace.has('old')).toBe(false);
    // Expiry hands the seat to the nearest preload.
    const g3 = new Map([['old', 1000 + FEED_VIDEO_LOAD_GRACE_MS]]);
    const s3 = run({ slots, activeId: 'act', prevAllowed: new Set(['old', 'act']), graceUntil: g3, now: 1000 + FEED_VIDEO_LOAD_GRACE_MS + 1 });
    expect([...s3].sort()).toEqual(['act', 'near']);
    // Pin + active preempt a grace seat.
    const g4 = new Map([['old', 99999]]);
    const s4 = run({ slots: [...slots, g('pin', 0)], activeId: 'act', pinned: new Set(['pin']), prevAllowed: new Set(['old']), graceUntil: g4 });
    expect([...s4].sort()).toEqual(['act', 'pin']);
  });

  it('removed slots are dropped from every set', () => {
    const grace = new Map([['gone', 99999]]);
    const set = run({ slots: [g('a', 0)], activeId: 'gone', pinned: new Set(['gone']), prevAllowed: new Set(['gone']), graceUntil: grace });
    expect(set.has('gone')).toBe(false);
    expect(grace.has('gone')).toBe(false);
  });
});
