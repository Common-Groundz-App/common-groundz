/**
 * Phase 3C Stage 2 — the frozen v1 question matrix, asserted per type.
 *
 * Every type gets `would_recommend` + `stood_out` (except `food`, whose Food Tags
 * already are its "what stood out"), its own repeat-intent wording (`course` has
 * none) and its extra dimension (`movie` and `others` have none).
 */
import { describe, expect, it } from 'vitest';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import {
  LEGACY_UNLINKED_QUESTIONNAIRE,
  QUESTIONNAIRE_REGISTRY,
} from '@/components/profile/reviews/questionnaire/registry';

const EXPECTED: Record<string, { fields: string[]; repeatIntentLabel: string | null }> = {
  food: {
    fields: ['would_recommend', 'repeat_intent', 'portion', 'food_tags'],
    repeatIntentLabel: 'Order again?',
  },
  place: {
    fields: ['would_recommend', 'repeat_intent', 'stood_out', 'best_for'],
    repeatIntentLabel: 'Go back?',
  },
  product: {
    fields: ['would_recommend', 'repeat_intent', 'value', 'stood_out'],
    repeatIntentLabel: 'Buy again?',
  },
  brand: {
    fields: ['would_recommend', 'repeat_intent', 'trust', 'stood_out'],
    repeatIntentLabel: 'Buy from them again?',
  },
  movie: {
    fields: ['would_recommend', 'repeat_intent', 'stood_out'],
    repeatIntentLabel: 'Rewatch?',
  },
  tv_show: {
    fields: ['would_recommend', 'repeat_intent', 'worth_time', 'stood_out'],
    repeatIntentLabel: 'Watch more?',
  },
  book: {
    fields: ['would_recommend', 'repeat_intent', 'worth_time', 'stood_out'],
    repeatIntentLabel: 'Read again?',
  },
  game: {
    fields: ['would_recommend', 'repeat_intent', 'worth_time', 'stood_out'],
    repeatIntentLabel: 'Play again?',
  },
  app: {
    fields: ['would_recommend', 'repeat_intent', 'solves_problem', 'stood_out'],
    repeatIntentLabel: 'Keep using?',
  },
  course: {
    fields: ['would_recommend', 'worth_time', 'stood_out', 'best_for'],
    repeatIntentLabel: null,
  },
  service: {
    fields: ['would_recommend', 'repeat_intent', 'value', 'stood_out'],
    repeatIntentLabel: 'Use again?',
  },
  professional: {
    fields: ['would_recommend', 'repeat_intent', 'trust', 'stood_out'],
    repeatIntentLabel: 'Work with them again?',
  },
  event: {
    fields: ['would_recommend', 'repeat_intent', 'worth_time', 'stood_out'],
    repeatIntentLabel: 'Attend again?',
  },
  experience: {
    fields: ['would_recommend', 'repeat_intent', 'worth_time', 'stood_out'],
    repeatIntentLabel: 'Do again?',
  },
  others: {
    fields: ['would_recommend', 'repeat_intent', 'stood_out'],
    repeatIntentLabel: 'Choose again?',
  },
};

const STORED_VALUES: Record<string, string[]> = {
  would_recommend: ['yes', 'maybe', 'no'],
  repeat_intent: ['yes', 'maybe', 'no'],
  value: ['poor', 'fair', 'good', 'excellent'],
  worth_time: ['yes', 'mostly', 'no'],
  trust: ['low', 'medium', 'high'],
  solves_problem: ['yes', 'partly', 'no'],
  portion: ['small', 'just_right', 'large'],
};

describe('frozen v1 questionnaire matrix', () => {
  it('covers all 15 canonical types and nothing else', () => {
    expect(Object.keys(QUESTIONNAIRE_REGISTRY).sort()).toEqual([...CANONICAL_ENTITY_TYPES].sort());
    expect(Object.keys(EXPECTED).sort()).toEqual([...CANONICAL_ENTITY_TYPES].sort());
  });

  for (const type of CANONICAL_ENTITY_TYPES) {
    describe(type, () => {
      const config = QUESTIONNAIRE_REGISTRY[type];
      const fields = config.sections.flatMap((s) => s.fields);
      const expected = EXPECTED[type];

      it('declares exactly the frozen fields, in order', () => {
        expect(fields.map((f) => f.id)).toEqual(expected.fields);
      });

      it('uses the frozen repeat-intent wording', () => {
        const repeat = fields.find((f) => f.id === 'repeat_intent');
        expect(repeat?.label ?? null).toBe(expected.repeatIntentLabel);
      });

      it('has no required questions — every answer is optional', () => {
        expect(fields.every((f) => f.required === false)).toBe(true);
      });

      it('uses the frozen stored codes for every choice field', () => {
        for (const field of fields) {
          if (field.kind !== 'single-choice') continue;
          expect(field.options?.map((o) => o.value)).toEqual(STORED_VALUES[field.id]);
        }
      });

      it('points curated tag fields at this type\'s own vocabulary', () => {
        for (const field of fields) {
          if (field.kind !== 'tags' || field.tagSet === 'food') continue;
          expect(field.tagSet).toBe(`${field.id}:${type}`);
        }
      });
    });
  }

  it('keeps food on the untouched FoodTagSelector vocabulary and gives it no generic stood_out', () => {
    const fields = QUESTIONNAIRE_REGISTRY.food.sections.flatMap((s) => s.fields);
    expect(fields.find((f) => f.id === 'food_tags')?.tagSet).toBe('food');
    expect(fields.some((f) => f.id === 'stood_out')).toBe(false);
    expect(fields.some((f) => f.id === 'value')).toBe(false);
  });

  it('gives legacy-unlinked reviews no questions at all', () => {
    expect(LEGACY_UNLINKED_QUESTIONNAIRE.sections).toEqual([]);
  });
});
