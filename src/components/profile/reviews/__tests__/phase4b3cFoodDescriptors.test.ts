import { describe, it, expect } from 'vitest';
import { FOOD_DESCRIPTOR_TAGS, resolveFoodTag } from '../FoodTagSelector';
import { getQuestionnaireConfig } from '../questionnaire/registry';

describe('Phase 4B.3C food descriptors', () => {
  it('suggests exactly the eight sensory descriptors', () => {
    expect(FOOD_DESCRIPTOR_TAGS.map((t) => t.name)).toEqual([
      'Spicy', 'Sweet', 'Savory', 'Tangy', 'Creamy', 'Crunchy', 'Rich', 'Light',
    ]);
  });

  it('allows 5 tags, then blocks the 6th', () => {
    const five = ['a', 'b', 'c', 'd', 'e'];
    expect(resolveFoodTag(five.slice(0, 4), 'e')).toEqual({ tag: 'e' });
    expect('error' in resolveFoodTag(five, 'f')).toBe(true);
  });

  it('allows all 5 to be custom', () => {
    expect(resolveFoodTag(['x1', 'x2', 'x3', 'x4'], 'x5')).toEqual({ tag: 'x5' });
  });

  it('rejects custom tags over 40 characters', () => {
    expect('error' in resolveFoodTag([], 'a'.repeat(41))).toBe(true);
    expect(resolveFoodTag([], 'a'.repeat(40))).toEqual({ tag: 'a'.repeat(40) });
  });

  it('prevents case-insensitive duplicates and matches curated labels', () => {
    expect('error' in resolveFoodTag(['Spicy'], 'spicy')).toBe(true);
    expect(resolveFoodTag([], '  sPiCy ')).toEqual({ tag: 'Spicy' });
  });

  it('renames the food question', () => {
    const cfg = getQuestionnaireConfig('food');
    const field = cfg.sections.flatMap((s) => s.fields).find((f) => f.id === 'food_tags');
    expect(field?.label).toBe('How would you describe it?');
  });
});
