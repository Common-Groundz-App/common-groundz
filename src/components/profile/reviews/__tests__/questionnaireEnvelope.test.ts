/**
 * Phase 3C Stage 2 — `metadata.questionnaire` read/patch contract.
 *
 * Mirrors the Stage 1 SQL resolver's strictness (numeric v1, `type` equals
 * `reviews.category`, object `answers`) and proves the field-level dirty
 * patching rules: untouched fields byte-identical, clearing removes the
 * envelope, incompatible envelopes never rendered and never destroyed.
 */
import { describe, expect, it } from 'vitest';
import {
  buildQuestionnairePatch,
  hydrateQuestionnaireAnswers,
  isQuestionnaireWritable,
  readQuestionnaireEnvelope,
} from '@/components/profile/reviews/questionnaire/envelope';
import { QUESTIONNAIRE_REGISTRY } from '@/components/profile/reviews/questionnaire/registry';

const movie = QUESTIONNAIRE_REGISTRY.movie;
const place = QUESTIONNAIRE_REGISTRY.place;

const validMetadata = {
  provenance: { source: 'import' },
  questionnaire: {
    version: 1,
    type: 'movie',
    answers: {
      would_recommend: 'yes',
      stood_out: { selected: ['slow_pacing'], custom: ['Great practical effects'] },
    },
  },
};

describe('reading the envelope', () => {
  it('reports absent when there is no questionnaire key', () => {
    expect(readQuestionnaireEnvelope({ provenance: {} }, 'movie')).toEqual({ status: 'absent' });
    expect(readQuestionnaireEnvelope(null, 'movie')).toEqual({ status: 'absent' });
  });

  it('reads a valid numeric-v1 envelope whose type matches the category', () => {
    const read = readQuestionnaireEnvelope(validMetadata, 'movie');
    expect(read.status).toBe('valid');
  });

  it('treats the string "1" as malformed, exactly like the SQL resolver', () => {
    const read = readQuestionnaireEnvelope(
      { questionnaire: { version: '1', type: 'movie', answers: {} } },
      'movie',
    );
    expect(read.status).toBe('incompatible');
  });

  it('treats a type mismatch and an unsupported version as incompatible', () => {
    expect(readQuestionnaireEnvelope(validMetadata, 'book').status).toBe('incompatible');
    expect(
      readQuestionnaireEnvelope(
        { questionnaire: { version: 999, type: 'movie', answers: {} } },
        'movie',
      ).status,
    ).toBe('incompatible');
    expect(
      readQuestionnaireEnvelope({ questionnaire: { version: 1, type: 'movie' } }, 'movie').status,
    ).toBe('incompatible');
  });
});

describe('hydration', () => {
  it('restores recognized answers only', () => {
    const hydrated = hydrateQuestionnaireAnswers(
      readQuestionnaireEnvelope(validMetadata, 'movie'),
      movie,
    );
    expect(hydrated.choices).toEqual({ would_recommend: 'yes' });
    expect(hydrated.curated.stood_out).toEqual({
      selected: ['slow_pacing'],
      custom: ['Great practical effects'],
    });
  });

  it('does not render unknown tag ids or invalid choice codes', () => {
    const read = readQuestionnaireEnvelope(
      {
        questionnaire: {
          version: 1,
          type: 'movie',
          answers: {
            would_recommend: 'definitely',
            stood_out: { selected: ['from_a_future_build'], custom: ['x'] },
          },
        },
      },
      'movie',
    );
    const hydrated = hydrateQuestionnaireAnswers(read, movie);
    expect(hydrated.choices).toEqual({});
    expect(hydrated.curated.stood_out).toEqual({ selected: [], custom: ['x'] });
  });

  it('renders every recognized value even when the stored field is over cap', () => {
    const selected = ['solo', 'couples', 'family', 'friends', 'kids', 'work', 'celebrations'];
    const read = readQuestionnaireEnvelope(
      { questionnaire: { version: 1, type: 'place', answers: { best_for: { selected } } } },
      'place',
    );
    const hydrated = hydrateQuestionnaireAnswers(read, place);
    expect(hydrated.curated.best_for.selected).toEqual(selected);
  });

  it('renders nothing for an incompatible envelope', () => {
    const hydrated = hydrateQuestionnaireAnswers({ status: 'incompatible' }, movie);
    expect(hydrated).toEqual({ choices: {}, curated: {} });
  });
});

describe('patch building', () => {
  const base = {
    category: 'movie',
    config: movie,
    choices: {} as Record<string, string>,
    curated: {},
  };

  it('writes nothing when the user touched no questionnaire field', () => {
    expect(
      buildQuestionnairePatch({
        ...base,
        read: { status: 'absent' },
        touchedFieldIds: new Set(),
      }),
    ).toEqual({ action: 'none' });
  });

  it('creates the envelope only once a real answer is supplied', () => {
    const patch = buildQuestionnairePatch({
      ...base,
      read: { status: 'absent' },
      choices: { would_recommend: 'no' },
      touchedFieldIds: new Set(['would_recommend']),
    });
    expect(patch).toEqual({
      action: 'write',
      envelope: { version: 1, type: 'movie', answers: { would_recommend: 'no' } },
    });
  });

  it('writes version as a JSON number, not a string', () => {
    const patch = buildQuestionnairePatch({
      ...base,
      read: { status: 'absent' },
      choices: { would_recommend: 'yes' },
      touchedFieldIds: new Set(['would_recommend']),
    });
    expect(patch.action).toBe('write');
    if (patch.action === 'write') expect(typeof patch.envelope.version).toBe('number');
  });

  it('omits unanswered fields rather than writing "", null or []', () => {
    const patch = buildQuestionnairePatch({
      ...base,
      read: { status: 'absent' },
      choices: { would_recommend: 'yes' },
      curated: { stood_out: { selected: [], custom: [] } },
      touchedFieldIds: new Set(['would_recommend', 'stood_out']),
    });
    expect(patch.action).toBe('write');
    if (patch.action === 'write') {
      expect(Object.keys(patch.envelope.answers)).toEqual(['would_recommend']);
    }
  });

  it('carries untouched fields through byte-identical, including unknown ones', () => {
    const read = readQuestionnaireEnvelope(
      {
        questionnaire: {
          version: 1,
          type: 'movie',
          answers: {
            would_recommend: 'yes',
            a_future_field: { anything: [1, 2, 3] },
          },
        },
      },
      'movie',
    );
    const patch = buildQuestionnairePatch({
      ...base,
      read,
      choices: { would_recommend: 'yes' },
      curated: { stood_out: { selected: ['overhyped'], custom: [] } },
      touchedFieldIds: new Set(['stood_out']),
    });
    expect(patch.action).toBe('write');
    if (patch.action === 'write') {
      expect(patch.envelope.answers.a_future_field).toEqual({ anything: [1, 2, 3] });
      expect(patch.envelope.answers.would_recommend).toBe('yes');
      expect(patch.envelope.answers.stood_out).toEqual({ selected: ['overhyped'] });
    }
  });

  it('removes the envelope when the last remaining answer is cleared', () => {
    const read = readQuestionnaireEnvelope(
      { questionnaire: { version: 1, type: 'movie', answers: { would_recommend: 'yes' } } },
      'movie',
    );
    const patch = buildQuestionnairePatch({
      ...base,
      read,
      choices: {},
      touchedFieldIds: new Set(['would_recommend']),
    });
    expect(patch).toEqual({ action: 'remove' });
  });

  it('keeps the envelope when an untouched unknown field remains', () => {
    const read = readQuestionnaireEnvelope(
      {
        questionnaire: {
          version: 1,
          type: 'movie',
          answers: { would_recommend: 'yes', a_future_field: 'keep me' },
        },
      },
      'movie',
    );
    const patch = buildQuestionnairePatch({
      ...base,
      read,
      choices: {},
      touchedFieldIds: new Set(['would_recommend']),
    });
    expect(patch).toEqual({
      action: 'write',
      envelope: { version: 1, type: 'movie', answers: { a_future_field: 'keep me' } },
    });
  });

  it('never creates, updates or destroys an incompatible envelope', () => {
    expect(
      buildQuestionnairePatch({
        ...base,
        read: { status: 'incompatible' },
        choices: { would_recommend: 'yes' },
        touchedFieldIds: new Set(['would_recommend']),
      }),
    ).toEqual({ action: 'none' });
  });
});

describe('compatibility mode', () => {
  it('is writable only when the category equals the subject canonical type', () => {
    expect(isQuestionnaireWritable('movie', 'movie')).toBe(true);
    expect(isQuestionnaireWritable('movie', 'book')).toBe(false);
    expect(isQuestionnaireWritable('movie', null)).toBe(false);
    expect(isQuestionnaireWritable(null, 'movie')).toBe(false);
  });
});
