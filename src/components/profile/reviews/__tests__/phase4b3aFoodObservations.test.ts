/**
 * Phase 4B.3A — Food "What did you like?" / "What could be better?".
 */
import { describe, expect, it } from 'vitest';
import {
  CURATED_TAG_VOCABULARIES,
  getCuratedTagLimits,
} from '@/components/profile/reviews/questionnaire/vocabularies';
import { QUESTIONNAIRE_REGISTRY } from '@/components/profile/reviews/questionnaire/registry';
import {
  buildQuestionnairePatch,
  hydrateQuestionnaireAnswers,
  type EnvelopeRead,
} from '@/components/profile/reviews/questionnaire/envelope';
import type { CuratedTagAnswer } from '@/components/profile/reviews/questionnaire/curatedTagInput';

describe('food observation vocabulary', () => {
  it('liked:food is exactly the 6 approved tags', () => {
    expect(CURATED_TAG_VOCABULARIES['liked:food'].map((t) => t.label)).toEqual([
      'Great taste', 'Fresh ingredients', 'Generous portion', 'Good presentation', 'Great aroma', 'Good texture',
    ]);
  });
  it('could_be_better:food is exactly the 6 approved tags', () => {
    expect(CURATED_TAG_VOCABULARIES['could_be_better:food'].map((t) => t.label)).toEqual([
      'Too salty', 'Too oily', 'Served cold', 'Portion too small', 'Lacked flavor', 'Overcooked',
    ]);
  });
  it('does not include Authentic flavor', () => {
    expect(CURATED_TAG_VOCABULARIES['liked:food'].some((t) => t.value === 'authentic_flavor')).toBe(false);
  });
  it('each group allows 5 total and 5 custom', () => {
    expect(getCuratedTagLimits('liked:food')).toMatchObject({ maxTotal: 5, maxCustom: 5 });
    expect(getCuratedTagLimits('could_be_better:food')).toMatchObject({ maxTotal: 5, maxCustom: 5 });
  });
  it('food keeps portion and food_tags', () => {
    const ids = QUESTIONNAIRE_REGISTRY.food.sections.flatMap((s) => s.fields).map((f) => f.id);
    expect(ids).toContain('portion');
    expect(ids).toContain('food_tags');
  });
});

describe('food observation persistence', () => {
  const config = QUESTIONNAIRE_REGISTRY.food;
  const empty: CuratedTagAnswer = { selected: [], custom: [] };
  const valid = (answers: Record<string, unknown>): EnvelopeRead => ({ status: 'valid', answers } as EnvelopeRead);
  const write = (read: EnvelopeRead, curated: Record<string, CuratedTagAnswer>, touched: string[]) =>
    buildQuestionnairePatch({ read, category: 'food', config, choices: {}, curated, touchedFieldIds: new Set(touched) });
  const answersOf = (p: ReturnType<typeof write>) => (p.action === 'write' ? p.envelope.answers : null);

  it('empty groups are omitted', () => {
    expect(write({ status: 'absent' } as EnvelopeRead, { liked: empty, could_be_better: empty }, ['liked', 'could_be_better']))
      .toEqual({ action: 'none' });
  });
  it('saves, reopens, and clears independently', () => {
    const both = answersOf(write({ status: 'absent' } as EnvelopeRead, {
      liked: { selected: ['great_taste'], custom: ['Crispy'] },
      could_be_better: { selected: ['too_salty'], custom: [] },
    }, ['liked', 'could_be_better']))!;
    expect(both).toEqual({ liked: { selected: ['great_taste'], custom: ['Crispy'] }, could_be_better: { selected: ['too_salty'] } });
    const h = hydrateQuestionnaireAnswers(valid(both), config);
    expect(h.curated.liked).toEqual({ selected: ['great_taste'], custom: ['Crispy'] });
    expect(answersOf(write(valid(both), { liked: empty }, ['liked']))).toEqual({ could_be_better: { selected: ['too_salty'] } });
  });
  it('existing food review without observations is not rewritten when untouched', () => {
    const old = { would_recommend: 'yes', portion: 'just_right' };
    expect(write(valid(old), {}, [])).toEqual({ action: 'none' });
  });
});
