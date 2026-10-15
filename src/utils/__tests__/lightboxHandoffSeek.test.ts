import { describe, it, expect } from 'vitest';
import { decideHandoffSeek, handoffTarget, isTimeSeekable } from '@/utils/lightboxHandoffSeek';

const ranges = (...r: [number, number][]) => ({
  length: r.length,
  start: (i: number) => r[i][0],
  end: (i: number) => r[i][1],
});

describe('lightbox handoff seek', () => {
  it('zero-time handoff completes immediately', () => {
    expect(decideHandoffSeek({ currentTime: 0, target: 0, seekable: null, seekIssued: false })).toBe('complete');
  });

  it('nonzero target already reached completes without waiting for seeked', () => {
    expect(decideHandoffSeek({ currentTime: 12.02, target: 12, seekable: ranges([0, 1]), seekIssued: false })).toBe('complete');
  });

  it('Infinity/NaN duration does not block seeking or clamp', () => {
    expect(handoffTarget(15, Infinity)).toBe(15);
    expect(handoffTarget(15, NaN)).toBe(15);
    expect(handoffTarget(15, 10)).toBe(9.5);
  });

  it('waits while target is not yet seekable, then seeks once it is', () => {
    expect(decideHandoffSeek({ currentTime: 0, target: 15, seekable: ranges([0, 6]), seekIssued: false })).toBe('wait');
    expect(decideHandoffSeek({ currentTime: 0, target: 15, seekable: ranges([0, 20]), seekIssued: false })).toBe('seek');
  });

  it('never re-issues a seek once issued', () => {
    expect(decideHandoffSeek({ currentTime: 0, target: 15, seekable: ranges([0, 20]), seekIssued: true })).toBe('wait');
    expect(decideHandoffSeek({ currentTime: 15.1, target: 15, seekable: ranges([0, 20]), seekIssued: true })).toBe('complete');
  });

  it('seekable check spans multiple ranges', () => {
    expect(isTimeSeekable(ranges([0, 2], [10, 20]), 12)).toBe(true);
    expect(isTimeSeekable(ranges([0, 2], [10, 20]), 5)).toBe(false);
  });
});
