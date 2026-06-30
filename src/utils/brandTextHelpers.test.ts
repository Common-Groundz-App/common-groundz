// Plan v10 — parity tests for normalizeBrandName / slugifyBrandName / brandTokens.
// Vitest-compatible structure; harmless no-op if vitest absent at import time
// (matches the project convention in renderBranching.test.ts).
import { normalizeBrandName } from './brandNormalize';
import { slugifyBrandName } from './brandSlug';
import { brandTokens } from './brandTokens';

declare const describe: undefined | ((name: string, fn: () => void) => void);
declare const it: undefined | ((name: string, fn: () => void) => void);
declare const expect:
  | undefined
  | ((v: unknown) => { toBe: (v: unknown) => void; toEqual: (v: unknown) => void });

if (typeof describe === 'function' && typeof it === 'function' && typeof expect === 'function') {
  describe('normalizeBrandName', () => {
    const cases = ['AXIS-Y', 'Axis Y', 'AXIS Y', 'axis_y', 'axisy', 'axis.y', '  axis y  '];
    for (const input of cases) {
      it(`${JSON.stringify(input)} -> "axisy"`, () => {
        expect(normalizeBrandName(input)).toBe('axisy');
      });
    }
    it('handles empty/non-string safely', () => {
      expect(normalizeBrandName('')).toBe('');
      expect(normalizeBrandName(null as unknown as string)).toBe('');
      expect(normalizeBrandName(undefined as unknown as string)).toBe('');
    });
  });

  describe('slugifyBrandName', () => {
    const cases = ['AXIS-Y', 'Axis Y', 'axis_y', 'axis y', 'Axis--Y', '  axis-y  '];
    for (const input of cases) {
      it(`${JSON.stringify(input)} -> "axis-y"`, () => {
        expect(slugifyBrandName(input)).toBe('axis-y');
      });
    }
  });

  describe('brandTokens', () => {
    it('AXIS-Y -> ["axis","y"]', () => expect(brandTokens('AXIS-Y')).toEqual(['axis', 'y']));
    it('H&M -> ["h","m"]', () => expect(brandTokens('H&M')).toEqual(['h', 'm']));
    it('A1 -> ["a1"]', () => expect(brandTokens('A1')).toEqual(['a1']));
    it('double-space -> ["axis","y"]', () => expect(brandTokens('Axis  Y')).toEqual(['axis', 'y']));
    it('empty -> []', () => expect(brandTokens('')).toEqual([]));
  });

  describe('cross-check normalize(slug(x)) == normalize(x)', () => {
    const axisVariants = ['AXIS-Y', 'Axis Y', 'AXIS Y', 'axis_y', 'axis.y'];
    for (const v of axisVariants) {
      it(JSON.stringify(v), () => {
        expect(normalizeBrandName(slugifyBrandName(v))).toBe(normalizeBrandName(v));
      });
    }
  });
}

export const brandTextHelperCases = {
  normalize_axis: ['AXIS-Y', 'Axis Y', 'AXIS Y', 'axis_y', 'axisy', 'axis.y'],
  slug_axis: ['AXIS-Y', 'Axis Y', 'axis_y', 'axis y', 'Axis--Y'],
};
