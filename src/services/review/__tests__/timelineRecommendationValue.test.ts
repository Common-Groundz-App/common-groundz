import { describe, expect, it } from 'vitest';
import { toTimelineRecommendationValue } from '../timeline';

describe('toTimelineRecommendationValue (five distinct states)', () => {
  it.each([
    [false, 'yes', 'yes'],
    [false, 'maybe', 'maybe'],
    [false, 'no', 'no'],
    [true, null, 'auto'],
    [true, 'yes', 'auto'],
    [false, null, null],
  ] as const)('baseOnRating=%s, choice=%s -> %s', (base, choice, expected) => {
    expect(toTimelineRecommendationValue(base, choice)).toBe(expected);
  });

  it('never collapses auto into "no statement"', () => {
    expect(toTimelineRecommendationValue(true, null)).not.toBeNull();
  });
});
