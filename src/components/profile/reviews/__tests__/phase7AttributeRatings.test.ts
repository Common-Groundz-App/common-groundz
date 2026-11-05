import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import {
  ATTRIBUTE_RATINGS,
  ATTRIBUTE_RATINGS_FIELD_ID,
  getQuestionnaireConfig,
} from '../questionnaire/registry';
import {
  attributeRatingKey,
  buildQuestionnairePatch,
  hydrateQuestionnaireAnswers,
  readValidAttributeRatings,
  type EnvelopeRead,
} from '../questionnaire/envelope';

const K = (id: string) => attributeRatingKey(ATTRIBUTE_RATINGS_FIELD_ID, id);
const food = getQuestionnaireConfig('food');
const stored = (answers: Record<string, unknown>): EnvelopeRead => ({ status: 'valid', answers });

const HISTORICAL = {
  would_recommend: 'yes',
  attribute_ratings: { taste_flavor: 5, presentation: 4, old_attribute: 3, freshness: 9 },
};

function patch(read: EnvelopeRead, choices: Record<string, string>, touched: string[]) {
  return buildQuestionnairePatch({
    read,
    category: 'food',
    config: food,
    choices,
    curated: {},
    touchedFieldIds: new Set(touched),
  });
}

describe('Phase 7B attribute matrix', () => {
  it('declares the approved attributes and none for others', () => {
    expect(ATTRIBUTE_RATINGS.others).toEqual([]);
    expect(ATTRIBUTE_RATINGS.food.map((a) => a.id)).toEqual(['taste_flavor', 'texture', 'freshness', 'presentation']);
    expect(ATTRIBUTE_RATINGS.book.map((a) => a.id)).toEqual(['writing_style', 'depth', 'pacing']);
    expect(ATTRIBUTE_RATINGS.game.map((a) => a.id)).toEqual(['gameplay', 'visuals', 'performance']);
    expect(ATTRIBUTE_RATINGS.product.map((a) => a.id)).toEqual(['quality', 'effectiveness', 'ease_of_use']);
    expect(ATTRIBUTE_RATINGS.movie.map((a) => a.id)).toEqual(['story', 'acting', 'visuals', 'pacing']);
  });

  it('renders a section for the 14 types and never for others', () => {
    for (const t of CANONICAL_ENTITY_TYPES) {
      const has = getQuestionnaireConfig(t).sections.some((s) => s.id === 'attribute_ratings');
      expect(has).toBe(t !== 'others');
    }
  });
});

describe('Phase 7B hydration', () => {
  it('shows only valid declared ratings', () => {
    const h = hydrateQuestionnaireAnswers(stored(HISTORICAL), food);
    expect(h.choices[K('taste_flavor')]).toBe('5');
    expect(h.choices[K('presentation')]).toBe('4');
    expect(h.choices[K('freshness')]).toBeUndefined(); // 9 is malformed
    expect(h.choices[K('old_attribute')]).toBeUndefined(); // retired: not offered
  });

  it('valid reader excludes malformed values', () => {
    expect(readValidAttributeRatings({ a: 5, b: 0, c: 2.5, d: '4', e: 6, f: 1 })).toEqual({ a: 5, f: 1 });
    expect(readValidAttributeRatings('junk')).toEqual({});
  });
});

describe('Phase 7B save patch', () => {
  it('unrelated edit leaves attribute_ratings byte-identical', () => {
    const p = patch(stored(HISTORICAL), { would_recommend: 'no' }, ['would_recommend']);
    expect(p.action).toBe('write');
    if (p.action === 'write') {
      expect(p.envelope.answers.attribute_ratings).toEqual(HISTORICAL.attribute_ratings);
    }
  });

  it('editing one attribute preserves others, retired and untouched malformed entries', () => {
    const p = patch(stored(HISTORICAL), { [K('taste_flavor')]: '4', [K('presentation')]: '4' }, [K('taste_flavor')]);
    expect(p.action).toBe('write');
    if (p.action === 'write') {
      expect(p.envelope.answers.attribute_ratings).toEqual({
        taste_flavor: 4,
        presentation: 4,
        old_attribute: 3,
        freshness: 9,
      });
    }
  });

  it('clearing one attribute removes only that key', () => {
    const p = patch(stored(HISTORICAL), { [K('presentation')]: '4' }, [K('taste_flavor')]);
    if (p.action !== 'write') throw new Error('expected write');
    expect(p.envelope.answers.attribute_ratings).toEqual({ presentation: 4, old_attribute: 3, freshness: 9 });
  });

  it('omits attribute_ratings when the map becomes empty', () => {
    const p = patch(stored({ would_recommend: 'yes', attribute_ratings: { texture: 3 } }), {}, [K('texture')]);
    if (p.action !== 'write') throw new Error('expected write');
    expect('attribute_ratings' in p.envelope.answers).toBe(false);
  });

  it('only declared ids can be newly written', () => {
    const p = patch({ status: 'absent' }, { [K('hacked')]: '5', [K('texture')]: '2' }, [K('hacked'), K('texture')]);
    if (p.action !== 'write') throw new Error('expected write');
    expect(p.envelope.answers.attribute_ratings).toEqual({ texture: 2 });
  });

  it('rejects out-of-range draft values', () => {
    const p = patch({ status: 'absent' }, { [K('texture')]: '7' }, [K('texture')]);
    expect(p.action).toBe('none');
  });
});

describe('Phase 7B Timeline isolation', () => {
  it('timeline composer never references attribute ratings', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../../review-composer/screen/TimelineComposerScreen.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/attribute/i);
  });
});
