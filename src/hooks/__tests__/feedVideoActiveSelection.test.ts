import { describe, it, expect } from 'vitest';
import { selectActiveSlot } from '@/hooks/feedVideoActiveSelection';

const c = (id: string, effective: number, centerDist = 0) => ({ id, effective, centerDist });

describe('selectActiveSlot', () => {
  it('uses the 60% primary rule', () => {
    expect(selectActiveSlot([c('a', 0.7), c('b', 0.2)], null)).toEqual({ id: 'a', fallback: false });
  });
  it('picks exactly one dominant fallback when none reach 60%', () => {
    expect(selectActiveSlot([c('a', 0.4, 100), c('b', 0.5, 300)], null)).toEqual({ id: 'b', fallback: true });
  });
  it('breaks fallback ties by centre distance', () => {
    expect(selectActiveSlot([c('a', 0.45, 200), c('b', 0.45, 50)], null).id).toBe('b');
  });
  it('ignores candidates below 35%', () => {
    expect(selectActiveSlot([c('a', 0.34)], null)).toEqual({ id: null, fallback: false });
  });
  it('a 60% candidate replaces a current fallback', () => {
    expect(selectActiveSlot([c('a', 0.45), c('b', 0.61)], 'a').id).toBe('b');
  });
  it('keeps current fallback against a small-margin fallback challenger', () => {
    expect(selectActiveSlot([c('a', 0.4), c('b', 0.55)], 'a').id).toBe('a');
  });
  it('switches fallback when challenger beats by margin', () => {
    expect(selectActiveSlot([c('a', 0.36), c('b', 0.58)], 'a')).toEqual({ id: 'b', fallback: true });
  });
  it('keeps hysteresis between two primary candidates', () => {
    expect(selectActiveSlot([c('a', 0.65), c('b', 0.8)], 'a').id).toBe('a');
    expect(selectActiveSlot([c('a', 0.65), c('b', 0.9)], 'a').id).toBe('b');
  });
  it('drops current below keep and re-selects', () => {
    expect(selectActiveSlot([c('a', 0.2), c('b', 0.4)], 'a')).toEqual({ id: 'b', fallback: true });
  });
});
