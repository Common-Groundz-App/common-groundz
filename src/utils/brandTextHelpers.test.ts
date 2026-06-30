// Plan v10 — parity tests for normalizeBrandName / slugifyBrandName / brandTokens.
import { describe, expect, it } from 'vitest';
import { normalizeBrandName } from './brandNormalize';
import { slugifyBrandName } from './brandSlug';
import { brandTokens } from './brandTokens';

describe('normalizeBrandName', () => {
  const cases = ['AXIS-Y', 'Axis Y', 'AXIS Y', 'axis_y', 'axisy', 'axis.y', '  axis y  '];
  for (const input of cases) {
    it(`${JSON.stringify(input)} → "axisy"`, () => {
      expect(normalizeBrandName(input)).toBe('axisy');
    });
  }
  it('handles empty/non-string safely', () => {
    expect(normalizeBrandName('')).toBe('');
    // @ts-expect-error runtime safety
    expect(normalizeBrandName(null)).toBe('');
    // @ts-expect-error runtime safety
    expect(normalizeBrandName(undefined)).toBe('');
  });
});

describe('slugifyBrandName', () => {
  const cases = ['AXIS-Y', 'Axis Y', 'axis_y', 'axis y', 'Axis--Y', '  axis-y  '];
  for (const input of cases) {
    it(`${JSON.stringify(input)} → "axis-y"`, () => {
      expect(slugifyBrandName(input)).toBe('axis-y');
    });
  }
});

describe('brandTokens', () => {
  it('AXIS-Y → ["axis","y"]', () => expect(brandTokens('AXIS-Y')).toEqual(['axis', 'y']));
  it('H&M → ["h","m"]', () => expect(brandTokens('H&M')).toEqual(['h', 'm']));
  it('A1 → ["a1"]', () => expect(brandTokens('A1')).toEqual(['a1']));
  it('Axis  Y → ["axis","y"]', () => expect(brandTokens('Axis  Y')).toEqual(['axis', 'y']));
  it('empty → []', () => expect(brandTokens('')).toEqual([]));
});

describe('cross-check: normalizeBrandName(slugifyBrandName(x)) === normalizeBrandName(x)', () => {
  const axisVariants = ['AXIS-Y', 'Axis Y', 'AXIS Y', 'axis_y', 'axis.y'];
  for (const v of axisVariants) {
    it(JSON.stringify(v), () => {
      expect(normalizeBrandName(slugifyBrandName(v))).toBe(normalizeBrandName(v));
    });
  }
});
