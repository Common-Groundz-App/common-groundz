/**
 * Phase 5B — Best For on all 15 types + saved curated-tag preservation.
 */
import { describe, expect, it } from 'vitest';
import {
  CURATED_TAG_VOCABULARIES,
  getCuratedTagLimits,
  type CuratedTagSet,
} from '@/components/profile/reviews/questionnaire/vocabularies';
import { QUESTIONNAIRE_REGISTRY } from '@/components/profile/reviews/questionnaire/registry';
import { hydrateQuestionnaireAnswers } from '@/components/profile/reviews/questionnaire/envelope';
import {
  humanizeTagId,
  isAtCombinedCap,
  removeCustomTag,
  toggleCuratedTag,
} from '@/components/profile/reviews/questionnaire/curatedTagInput';

const ALL = Object.keys(QUESTIONNAIRE_REGISTRY) as (keyof typeof QUESTIONNAIRE_REGISTRY)[];

describe('Best for on every type', () => {
  it('covers all 15 canonical types', () => expect(ALL).toHaveLength(15));
  for (const type of ALL) {
    it(`${type}: optional Best for section with its own suggestions`, () => {
      const section = QUESTIONNAIRE_REGISTRY[type].sections.find((s) => s.id === 'best_for');
      expect(section?.title).toBe('Best for');
      const field = section!.fields[0];
      expect(field.required).toBe(false);
      expect(field.helperText).toBe('Who or what would you recommend this for?');
      expect(field.hideLabel).toBe(true);
      expect(field.tagSet).toBe(`best_for:${type}`);
      expect(CURATED_TAG_VOCABULARIES[field.tagSet as CuratedTagSet].length).toBeGreaterThanOrEqual(5);
      expect(getCuratedTagLimits(field.tagSet as CuratedTagSet)).toEqual({ maxCombined: 5, maxCustom: 5, maxCustomLength: 40 });
    });
  }
  it('keeps the existing Place and Course ids', () => {
    expect(CURATED_TAG_VOCABULARIES['best_for:place'].map((t) => t.value)).toEqual(
      ['solo', 'couples', 'family', 'friends', 'kids', 'work', 'celebrations', 'quick_stop']);
    expect(CURATED_TAG_VOCABULARIES['best_for:course'].map((t) => t.value)).toEqual(
      ['complete_beginners', 'some_experience', 'advanced', 'career_switchers', 'interview_prep', 'refresher']);
  });
});

describe('saved curated tags survive vocabulary changes', () => {
  const config = QUESTIONNAIRE_REGISTRY.event;
  const read = (best_for: unknown) =>
    ({ status: 'valid', answers: { best_for } }) as Parameters<typeof hydrateQuestionnaireAnswers>[0];

  it('keeps a retired id next to custom tags', () => {
    const h = hydrateQuestionnaireAnswers(read({ selected: ['retired_tag', 'networking'], custom: ['Great for toddlers'] }), config);
    expect(h.curated.best_for).toEqual({ selected: ['retired_tag', 'networking'], custom: ['Great for toddlers'] });
    expect(humanizeTagId('retired_tag')).toBe('Retired tag');
  });

  it('removing the retired id leaves other selections alone', () => {
    const answer = { selected: ['retired_tag', 'networking'], custom: ['Great for toddlers'] };
    const next = toggleCuratedTag(answer, 'retired_tag', getCuratedTagLimits('best_for:event')).answer;
    expect(next).toEqual({ selected: ['networking'], custom: ['Great for toddlers'] });
    expect(removeCustomTag(answer, 'Great for toddlers').answer.selected).toEqual(['retired_tag', 'networking']);
  });

  it('retired ids count toward the limit and are not truncated', () => {
    const six = ['a_one', 'b_two', 'c_three', 'd_four', 'e_five', 'f_six'];
    const h = hydrateQuestionnaireAnswers(read({ selected: six, custom: [] }), config);
    expect(h.curated.best_for.selected).toEqual(six);
    expect(isAtCombinedCap(h.curated.best_for, getCuratedTagLimits('best_for:event'))).toBe(true);
  });

  it('drops malformed values', () => {
    const h = hydrateQuestionnaireAnswers(read({ selected: ['Not An Id', 42, 'networking'], custom: [] }), config);
    expect(h.curated.best_for.selected).toEqual(['networking']);
  });
});
