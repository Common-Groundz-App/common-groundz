/**
 * Phase 4B.2 — "What did you like?" / "What could be better?".
 */
import { describe, expect, it } from 'vitest';
import {
  CURATED_TAG_VOCABULARIES,
  getCuratedTagLimits,
  type CuratedTagSet,
} from '@/components/profile/reviews/questionnaire/vocabularies';
import { QUESTIONNAIRE_REGISTRY } from '@/components/profile/reviews/questionnaire/registry';
import {
  buildQuestionnairePatch,
  hydrateQuestionnaireAnswers,
  type EnvelopeRead,
} from '@/components/profile/reviews/questionnaire/envelope';
import type { CuratedTagAnswer } from '@/components/profile/reviews/questionnaire/curatedTagInput';

const TYPES = [
  'place', 'product', 'brand', 'movie', 'tv_show', 'book', 'game', 'app',
  'course', 'service', 'professional', 'event', 'experience', 'others',
] as const;

const vocab = (k: string) => CURATED_TAG_VOCABULARIES[k as CuratedTagSet];
const ids = (k: string) => vocab(k).map((t) => t.value);

describe('observation vocabularies', () => {
  for (const type of TYPES) {
    it(`${type}: liked is positive only, could_be_better is negative only`, () => {
      expect(vocab(`liked:${type}`).length).toBeGreaterThan(0);
      expect(vocab(`could_be_better:${type}`).length).toBeGreaterThanOrEqual(3);
      expect(vocab(`liked:${type}`).every((t) => t.sentiment === 'positive')).toBe(true);
      expect(vocab(`could_be_better:${type}`).every((t) => t.sentiment === 'negative')).toBe(true);
      // Legacy positive/negative ids preserved verbatim.
      const legacy = vocab(`stood_out:${type}`);
      for (const t of legacy) {
        if (t.sentiment === 'positive') expect(ids(`liked:${type}`)).toContain(t.value);
        if (t.sentiment === 'negative') expect(ids(`could_be_better:${type}`)).toContain(t.value);
        if (t.sentiment === 'neutral') {
          expect(ids(`liked:${type}`)).not.toContain(t.value);
          expect(ids(`could_be_better:${type}`)).not.toContain(t.value);
        }
      }
    });
  }

  it('adds exactly the nine approved negatives', () => {
    const added: Record<string, string> = {
      movie: 'poor_pacing', tv_show: 'poor_pacing', book: 'hard_to_follow',
      game: 'poor_controls', course: 'unclear_explanations',
      professional: 'unprofessional_behavior', event: 'poor_organization',
      experience: 'poor_value', others: 'poor_quality',
    };
    for (const type of TYPES) {
      const legacyNeg = vocab(`stood_out:${type}`).filter((t) => t.sentiment === 'negative').length;
      const extra = ids(`could_be_better:${type}`).slice(legacyNeg);
      expect(extra).toEqual(added[type] ? [added[type]] : []);
    }
  });

  it('relabels touristy to "Too touristy" only where configured', () => {
    const t = vocab('could_be_better:experience').find((x) => x.value === 'touristy');
    expect(t?.label).toBe('Too touristy');
    const elsewhere = TYPES.filter((ty) => ty !== 'experience' && ids(`could_be_better:${ty}`).includes('touristy'));
    expect(elsewhere).toEqual([]);
  });

  it('limits: 5 total / 5 custom for both; best_for unchanged', () => {
    const five = { maxCombined: 5, maxCustom: 5, maxCustomLength: 40 };
    expect(getCuratedTagLimits('liked:place')).toEqual(five);
    expect(getCuratedTagLimits('could_be_better:movie')).toEqual(five);
    expect(getCuratedTagLimits('best_for:place')).toEqual({ maxCombined: 5, maxCustom: 3, maxCustomLength: 40 });
  });
});

describe('observation persistence', () => {
  const config = QUESTIONNAIRE_REGISTRY.place;
  const empty: CuratedTagAnswer = { selected: [], custom: [] };
  const write = (
    read: EnvelopeRead,
    curated: Record<string, CuratedTagAnswer>,
    touched: string[],
  ) =>
    buildQuestionnairePatch({
      read, category: 'place', config, choices: {}, curated, touchedFieldIds: new Set(touched),
    });
  const answersOf = (p: ReturnType<typeof write>) =>
    p.action === 'write' ? p.envelope.answers : null;
  const valid = (answers: Record<string, unknown>): EnvelopeRead =>
    ({ status: 'valid', answers } as EnvelopeRead);

  it('both unanswered: nothing written', () => {
    expect(write({ status: 'absent' } as EnvelopeRead, { liked: empty, could_be_better: empty }, ['liked', 'could_be_better']))
      .toEqual({ action: 'none' });
  });

  it('only liked answered: could_be_better stays absent', () => {
    const a = answersOf(write({ status: 'absent' } as EnvelopeRead, { liked: { selected: ['good_service'], custom: [] } }, ['liked']));
    expect(a).toEqual({ liked: { selected: ['good_service'] } });
  });

  it('only could_be_better answered: liked stays absent', () => {
    const a = answersOf(write({ status: 'absent' } as EnvelopeRead, { could_be_better: { selected: [], custom: ['Too loud'] } }, ['could_be_better']));
    expect(a).toEqual({ could_be_better: { custom: ['Too loud'] } });
  });

  it('both answered, then clearing one leaves the other intact', () => {
    const both = answersOf(write({ status: 'absent' } as EnvelopeRead, {
      liked: { selected: ['very_clean'], custom: [] },
      could_be_better: { selected: ['long_wait'], custom: [] },
    }, ['liked', 'could_be_better']))!;
    expect(both).toEqual({ liked: { selected: ['very_clean'] }, could_be_better: { selected: ['long_wait'] } });

    const cleared = answersOf(write(valid(both), { liked: empty }, ['liked']));
    expect(cleared).toEqual({ could_be_better: { selected: ['long_wait'] } });
  });

  it('reopening hydrates saved answers into both groups', () => {
    const h = hydrateQuestionnaireAnswers(
      valid({ liked: { selected: ['very_clean'], custom: ['Cosy'] }, could_be_better: { selected: ['overpriced'] } }),
      config,
    );
    expect(h.curated.liked).toEqual({ selected: ['very_clean'], custom: ['Cosy'] });
    expect(h.curated.could_be_better).toEqual({ selected: ['overpriced'], custom: [] });
  });

  it('legacy stood_out survives alongside new liked/could_be_better', () => {
    const legacy = { stood_out: { selected: ['great_ambience', 'quiet'], custom: ['old'] } };
    const a = answersOf(write(valid(legacy), {
      liked: { selected: ['good_value'], custom: [] },
      could_be_better: { selected: ['long_wait'], custom: [] },
    }, ['liked', 'could_be_better']));
    expect(a).toEqual({
      stood_out: legacy.stood_out,
      liked: { selected: ['good_value'] },
      could_be_better: { selected: ['long_wait'] },
    });
    // Legacy key is not rendered in the new editor.
    expect(hydrateQuestionnaireAnswers(valid(legacy), config).curated.stood_out).toBeUndefined();
  });
});
