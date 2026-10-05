import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MODES, resolveComposerMode, UnsupportedComposerModeError } from '../modes';
import { SECTIONS, hydrateValues } from '../sections';
import {
  composerReducer,
  composerSessionKey,
  hasUnsavedChanges,
  initialComposerState,
  isComposerDirty,
  canSubmit,
  type ComposerState,
} from '../store';
import { validateForSubmit, validateStep, sectionsOnStep, nextStep } from '../stepEngine';
import {
  buildCreateReviewPayload,
  buildCreateTimelinePayload,
  buildEditReviewPayload,
  buildEditTimelinePayload,
} from '../saveBuilders';
import { fromCreateReviewError, fromTimelineStatus, fromUpdateReviewError, toBlockedReason } from '../serverErrors';
import { gatherAmbiguousSaveEvidence, type ReconcileDeps } from '../reconcile';
import { cleanupCandidates, createUploadSession, uploadSessionReducer } from '../uploadSession';
import { SECTION_IDS, type ComposerSubject, type StoredReviewRecord, type StoredTimelineUpdateRecord } from '../values';

const FOOD: ComposerSubject = { id: 'e-food', name: 'Classic Burger', type: 'food', providerName: 'Truffles' };
const BOOK: ComposerSubject = { id: 'e-book', name: 'Dune', type: 'book' };
const BAD: ComposerSubject = { id: 'e-bad', name: 'Mystery', type: 'zzz' };

const storedReview = (over: Partial<StoredReviewRecord> = {}): StoredReviewRecord => ({
  id: 'r1',
  user_id: 'u1',
  entity_id: 'e-book',
  category: 'book',
  title: 'Dune',
  venue: '',
  subtitle: 'Great',
  description: 'Loved it',
  rating: 4,
  media: [{ url: 'https://x/a.jpg', type: 'image', order: 0 }],
  visibility: 'public',
  experience_date: '2026-01-01',
  metadata: {
    provenance: { source: 'x' },
    questionnaire: { version: 1, type: 'book', answers: { would_recommend: 'yes', future_key: 'keep' } },
  },
  status: 'published',
  entity: BOOK,
  ...over,
});

const storedUpdate = (over: Partial<StoredTimelineUpdateRecord> = {}): StoredTimelineUpdateRecord => ({
  id: 'up1',
  review_id: 'r1',
  user_id: 'u1',
  rating: 3,
  comment: 'Still good',
  media: [],
  would_recommend: 'auto',
  ...over,
});

function hydrated(mode: ComposerState['mode'], record: Parameters<typeof hydrateValues>[0], key = 'k'): ComposerState {
  const s = initialComposerState({ sessionKey: key, mode });
  return composerReducer(s, { type: 'HYDRATED', sessionKey: key, record });
}
const set = (s: ComposerState, id: any, value: unknown) =>
  composerReducer(s, { type: 'SET_VALUE', sessionKey: s.sessionKey, id, value });

/* ---------------------------------- modes ---------------------------------- */

describe('modes', () => {
  it('all four combinations resolve to their own row', () => {
    expect(resolveComposerMode('review', 'create').mode).toBe('create-review');
    expect(resolveComposerMode('review', 'edit').mode).toBe('edit-review');
    expect(resolveComposerMode('timeline-update', 'create').mode).toBe('create-timeline-update');
    expect(resolveComposerMode('timeline-update', 'edit').mode).toBe('edit-timeline-update');
  });
  it('unsupported combinations throw instead of falling back', () => {
    expect(() => resolveComposerMode('post', 'create')).toThrow(UnsupportedComposerModeError);
    expect(() => resolveComposerMode('review', 'delete')).toThrow(UnsupportedComposerModeError);
  });
  it('every step references an existing section that is not off', () => {
    for (const caps of Object.values(MODES)) {
      expect(caps.steps.length).toBeGreaterThan(0);
      for (const step of caps.steps) {
        expect(step.length).toBeGreaterThan(0);
        for (const id of step) {
          expect(SECTIONS[id]).toBeDefined();
          expect(caps.sections[id]).not.toBe('off');
        }
      }
    }
  });
  it('timeline modes have the questionnaire switched off', () => {
    expect(MODES['create-timeline-update'].sections.questionnaire).toBe('off');
    expect(MODES['edit-timeline-update'].sections.foodTags).toBe('off');
  });
});

/* ---------------------------------- state ---------------------------------- */

describe('store', () => {
  it('session keys are distinct per resource', () => {
    expect(composerSessionKey({ mode: 'edit-timeline-update', reviewId: 'r', updateId: 'u' })).toBe(
      'edit-timeline-update:r:u',
    );
    expect(composerSessionKey({ mode: 'create-review', nonce: 'n' })).toBe('create-review:n');
  });
  it('hydration does not mark anything dirty', () => {
    const s = hydrated('edit-review', { review: storedReview() });
    expect(isComposerDirty(s)).toBe(false);
    expect(s.values.headline).toBe('Great');
    expect(s.values.questionnaire.choices.would_recommend).toBe('yes');
  });
  it('change then restore clears dirty', () => {
    let s = hydrated('edit-review', { review: storedReview() });
    s = set(s, 'headline', 'Changed');
    expect(isComposerDirty(s)).toBe(true);
    s = set(s, 'headline', 'Great');
    expect(isComposerDirty(s)).toBe(false);
  });
  it('step moves never touch values or errors', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review', preselectedSubject: BOOK });
    s = set(s, 'rating', 4);
    s = set(s, 'media', [{ url: 'u', type: 'image', order: 0 }]);
    const before = JSON.stringify(s);
    nextStep(s, 0);
    nextStep(s, 1);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('a new session resets everything', () => {
    let s = hydrated('edit-review', { review: storedReview() }, 'edit-review:r1');
    s = set(s, 'headline', 'x');
    const fresh = initialComposerState({ sessionKey: 'edit-review:r2', mode: 'edit-review' });
    s = composerReducer(s, { type: 'START_SESSION', state: fresh });
    expect(s.values.headline).toBe('');
    expect(s.status).toBe('loading');
  });
  it('blocked cannot submit', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'edit-review' });
    s = composerReducer(s, { type: 'HYDRATE_FAILED', sessionKey: 'k', result: { status: 'unauthorized' } });
    expect(s.status).toBe('blocked');
    expect(canSubmit(s)).toBe(false);
    expect(composerReducer(s, { type: 'SAVE_STARTED', sessionKey: 'k' }).status).toBe('blocked');
  });
  it('ambiguous: evidence alone never unlocks; an explicit choice allows one manual retry', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-timeline-update' });
    s = composerReducer(s, { type: 'SAVE_STARTED', sessionKey: 'k' });
    s = composerReducer(s, { type: 'SAVE_STARTED', sessionKey: 'k' }); // double tap
    expect(s.status).toBe('saving');
    s = composerReducer(s, { type: 'SAVE_TIMEOUT', sessionKey: 'k' });
    expect(s.status).toBe('ambiguous');
    s = composerReducer(s, {
      type: 'EVIDENCE',
      sessionKey: 'k',
      evidence: { status: 'candidate-found', strength: 'weak', candidate: { id: 'x' } },
    });
    expect(s.status).toBe('ambiguous');
    expect(canSubmit(s)).toBe(false);
    expect(composerReducer(s, { type: 'SAVE_STARTED', sessionKey: 'k' }).status).toBe('ambiguous');
    s = composerReducer(s, { type: 'ALLOW_MANUAL_RETRY', sessionKey: 'k' });
    expect(canSubmit(s)).toBe(true);
    s = composerReducer(s, { type: 'SAVE_STARTED', sessionKey: 'k' });
    expect(s.status).toBe('saving');
    expect(s.manualRetryAllowed).toBe(false);
  });
  it('server results map to blocked or retryable', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-timeline-update' });
    s = composerReducer(s, { type: 'SAVE_STARTED', sessionKey: 'k' });
    const err = composerReducer(s, { type: 'SAVE_RESULT', sessionKey: 'k', result: { status: 'error' } });
    expect(err.status).toBe('ready');
    const exp = composerReducer(s, { type: 'SAVE_RESULT', sessionKey: 'k', result: { status: 'expired' } });
    expect(exp.status).toBe('blocked');
    expect(exp.blockedReason).toBe('expired');
  });
  it('unsaved-changes signal covers dirty values and session uploads', () => {
    const s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    expect(hasUnsavedChanges(s, 0)).toBe(false);
    expect(hasUnsavedChanges(s, 1)).toBe(true);
    expect(hasUnsavedChanges(set(s, 'rating', 3), 0)).toBe(true);
  });
  it('the subject is locked in edit and when preselected', () => {
    const edit = hydrated('edit-review', { review: storedReview() });
    expect(composerReducer(edit, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: FOOD }).values.subject).toEqual(BOOK);
    const pre = initialComposerState({ sessionKey: 'k', mode: 'create-review', preselectedSubject: BOOK });
    expect(composerReducer(pre, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: FOOD }).values.subject).toEqual(BOOK);
  });
});

/* ------------------------------ stale results ------------------------------ */

describe('old results never change the current session', () => {
  const kinds = [
    { type: 'HYDRATED', record: { review: storedReview() } },
    { type: 'HYDRATE_FAILED', result: { status: 'not_found' } },
    { type: 'SUBJECT_CHANGED', subject: FOOD },
    { type: 'VALIDATED', errors: { rating: 'x' } },
    { type: 'SAVE_RESULT', result: { status: 'ok' } },
    { type: 'SAVE_TIMEOUT' },
    { type: 'EVIDENCE', evidence: { status: 'not-observed' } },
  ] as const;
  it.each(kinds)('stale %s is ignored', (action) => {
    const current = initialComposerState({ sessionKey: 'edit-review:B', mode: 'edit-review' });
    const after = composerReducer(current, { ...(action as any), sessionKey: 'edit-review:A' });
    expect(after).toBe(current);
  });
  it('review A loading after review B is open does not hydrate B', () => {
    let s = initialComposerState({ sessionKey: 'edit-review:A', mode: 'edit-review' });
    s = composerReducer(s, { type: 'START_SESSION', state: initialComposerState({ sessionKey: 'edit-review:B', mode: 'edit-review' }) });
    s = composerReducer(s, { type: 'HYDRATED', sessionKey: 'edit-review:B', record: { review: storedReview({ id: 'B', subtitle: 'B' }) } });
    s = composerReducer(s, { type: 'HYDRATED', sessionKey: 'edit-review:A', record: { review: storedReview({ id: 'A', subtitle: 'A' }) } });
    expect(s.values.headline).toBe('B');
  });
  it('an old upload callback is ignored by the new upload session', () => {
    const s = createUploadSession('new', 'id2');
    expect(uploadSessionReducer(s, { type: 'UPLOADED', key: 'old', url: 'u' }).uploads).toEqual([]);
  });
});

/* -------------------------- three kinds of not-showing -------------------------- */

describe('section availability', () => {
  it('sections on another step stay active (validated and dirty)', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review', preselectedSubject: BOOK });
    s = set(s, 'media', new Array(5).fill({ url: 'u', type: 'image', order: 0 }));
    const media = sectionsOnStep(s, 0).find((x) => x.id === 'media');
    expect(media?.availability).toBe('not-rendered');
    expect(isComposerDirty(s)).toBe(true);
    const v = validateForSubmit(s);
    expect(v.errors.media).toBeTruthy();
  });
  it('mode-disabled questionnaire in timeline mode: inert and never saved', () => {
    let s = hydrated('create-timeline-update', {});
    s = composerReducer(s, { type: 'SET_QUESTIONNAIRE_CHOICE', sessionKey: 'k', fieldId: 'would_recommend', value: 'yes' });
    expect(isComposerDirty(s)).toBe(false);
    expect(sectionsOnStep(s, 0).some((x) => x.id === 'questionnaire')).toBe(false);
    const p = buildCreateTimelinePayload({ values: s.values, reviewId: 'r1' });
    expect(p.ok && Object.keys(p.payload).sort()).toEqual(['comment', 'media', 'review_id']);
  });
  it('Food → Book clears food tags and answers; Book → Food clears questionnaire', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: FOOD });
    s = set(s, 'foodTags', ['spicy']);
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: BOOK });
    expect(s.values.foodTags).toEqual([]);
    s = composerReducer(s, { type: 'SET_QUESTIONNAIRE_CHOICE', sessionKey: 'k', fieldId: 'would_recommend', value: 'yes' });
    expect(s.questionnaireTouched).toEqual(['would_recommend']);
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: FOOD });
    expect(s.values.questionnaire.choices).toEqual({});
    expect(s.questionnaireTouched).toEqual([]);
    const food = sectionsOnStep(s, 3).find((x) => x.id === 'foodTags');
    expect(food?.availability).toBe('enabled');
  });
  it('food tags are subject-incompatible on a book and never saved', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review', preselectedSubject: BOOK });
    s = { ...s, values: { ...s.values, foodTags: ['stale'], rating: 4 } };
    expect(sectionsOnStep(s, 3).find((x) => x.id === 'foodTags')?.availability).toBe('subject-incompatible');
    const p = buildCreateReviewPayload({ values: s.values, userId: 'u1', subjectOrigin: 'entity-page', questionnaireTouched: new Set() });
    expect(p.ok && p.payload.metadata).toBeUndefined();
  });
  it('mode-disabled sections never validate or block', () => {
    const s = hydrated('create-timeline-update', {});
    const v = validateForSubmit({ ...s, values: { ...s.values, text: 'x', visibility: 'nope' as any } });
    expect(v.ok).toBe(true);
    expect(v.errors.visibility).toBeUndefined();
  });
  it('invalid linked subject blocks', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: BAD });
    expect(validateStep(s, 1).firstInvalid).toBe('subject');
    expect(buildCreateReviewPayload({ values: s.values, userId: 'u', subjectOrigin: 'user-selected', questionnaireTouched: new Set() }).ok).toBe(false);
  });
  it('step engine returns the first invalid section', () => {
    const s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    expect(validateForSubmit(s).firstInvalid).toBe('rating');
    expect(nextStep(s, 0).stepIndex).toBe(0);
  });
});

/* ------------------------------- save builders ------------------------------- */

const FORBIDDEN_EDIT = ['user_id', 'entity_id', 'category', 'title', 'venue', 'status'];

describe('save builders', () => {
  it('create review derives identity from the persisted subject; no upload → no photo', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: FOOD });
    s = set(s, 'rating', 5);
    const r = buildCreateReviewPayload({ values: s.values, userId: 'u1', subjectOrigin: 'user-selected', questionnaireTouched: new Set() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toMatchObject({ entity_id: 'e-food', category: 'food', title: 'Classic Burger', venue: 'Truffles', image_url: null, media: [] });
  });
  it('first upload becomes the cover image', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review', preselectedSubject: BOOK });
    s = set(s, 'media', [{ url: 'https://a', type: 'image', order: 0 }, { url: 'https://b', type: 'image', order: 1 }]);
    const r = buildCreateReviewPayload({ values: s.values, userId: 'u', subjectOrigin: 'entity-page', questionnaireTouched: new Set() });
    expect(r.ok && r.payload.image_url).toBe('https://a');
  });
  it('edit review: exact allowlist, even with a loaded record spread into values', () => {
    let s = hydrated('edit-review', { review: storedReview() });
    s = set(s, 'headline', 'Changed');
    const polluted = { ...s.values, ...storedReview() } as any;
    const r = buildEditReviewPayload({ values: polluted, stored: s.stored, questionnaireTouched: new Set() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.payload).sort()).toEqual(
      ['description', 'experience_date', 'image_url', 'media', 'metadata', 'rating', 'subtitle', 'visibility'],
    );
    for (const k of FORBIDDEN_EDIT) expect(r.payload).not.toHaveProperty(k);
  });
  it('edit review: change one field keeps others and all unknown metadata', () => {
    let s = hydrated('edit-review', { review: storedReview() });
    s = set(s, 'rating', 2);
    const r = buildEditReviewPayload({ values: s.values, stored: s.stored, questionnaireTouched: new Set(s.questionnaireTouched) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).toEqual({
      subtitle: 'Great',
      description: 'Loved it',
      rating: 2,
      image_url: 'https://x/a.jpg',
      media: [{ url: 'https://x/a.jpg', type: 'image', order: 0 }],
      visibility: 'public',
      experience_date: '2026-01-01',
      metadata: storedReview().metadata,
    });
  });
  it('edit review: editing the questionnaire keeps unknown answer keys and provenance', () => {
    let s = hydrated('edit-review', { review: storedReview() });
    s = composerReducer(s, { type: 'SET_QUESTIONNAIRE_CHOICE', sessionKey: 'k', fieldId: 'would_recommend', value: 'no' });
    const r = buildEditReviewPayload({ values: s.values, stored: s.stored, questionnaireTouched: new Set(s.questionnaireTouched) });
    if (!r.ok) throw new Error('expected ok');
    const md = r.payload.metadata as any;
    expect(md.provenance).toEqual({ source: 'x' });
    expect(md.questionnaire.answers).toEqual({ would_recommend: 'no', future_key: 'keep' });
  });
  it('edit review: cleared and untouched stay distinct', () => {
    let s = hydrated('edit-review', { review: storedReview() });
    s = set(s, 'headline', '');
    const r = buildEditReviewPayload({ values: s.values, stored: s.stored, questionnaireTouched: new Set() });
    if (!r.ok) throw new Error();
    expect(r.payload.subtitle).toBe('');
    expect(r.payload.description).toBe('Loved it');
  });
  it('legacy unlinked edit never sends identity', () => {
    const s = hydrated('edit-review', { review: storedReview({ entity_id: null, entity: null, category: 'food', metadata: { food_tags: ['a'] } }) });
    const r = buildEditReviewPayload({ values: s.values, stored: s.stored, questionnaireTouched: new Set() });
    if (!r.ok) throw new Error();
    for (const k of FORBIDDEN_EDIT) expect(r.payload).not.toHaveProperty(k);
  });
  it('new timeline update: left out vs auto vs explicit', () => {
    let s = hydrated('create-timeline-update', {});
    s = set(s, 'text', '  Better now  ');
    const omitted = buildCreateTimelinePayload({ values: s.values, reviewId: 'r1' });
    expect(omitted.ok && omitted.payload).toEqual({ review_id: 'r1', comment: 'Better now', media: [] });
    const auto = buildCreateTimelinePayload({ values: set(s, 'recommendation', { baseOnRating: true, choice: null }).values, reviewId: 'r1' });
    expect(auto.ok && auto.payload.would_recommend).toBe('auto');
    const yes = buildCreateTimelinePayload({ values: set(set(s, 'recommendation', { baseOnRating: false, choice: 'yes' }), 'rating', 4).values, reviewId: 'r1' });
    expect(yes.ok && yes.payload).toMatchObject({ would_recommend: 'yes', rating: 4 });
  });
  it.each(['yes', 'maybe', 'no', 'auto', null] as const)('edit timeline round-trips %s', (w) => {
    const s = hydrated('edit-timeline-update', { update: storedUpdate({ would_recommend: w }) });
    const r = buildEditTimelinePayload({ values: s.values, reviewId: 'r1', updateId: 'up1' });
    expect(r.ok && r.payload.would_recommend).toBe(w);
  });
  it('auto survives a comment-only timeline edit', () => {
    let s = hydrated('edit-timeline-update', { update: storedUpdate({ would_recommend: 'auto' }) });
    s = set(s, 'text', 'Only the comment changed');
    const r = buildEditTimelinePayload({ values: s.values, reviewId: 'r1', updateId: 'up1' });
    if (!r.ok) throw new Error();
    expect(r.payload).toEqual({
      review_id: 'r1',
      update_id: 'up1',
      rating: 3,
      comment: 'Only the comment changed',
      media: [],
      would_recommend: 'auto',
    });
  });
  it('timeline payloads contain no review fields', () => {
    const s = hydrated('edit-timeline-update', { update: storedUpdate() });
    const r = buildEditTimelinePayload({ values: { ...s.values, headline: 'x', visibility: 'private' }, reviewId: 'r1', updateId: 'up1' });
    if (!r.ok) throw new Error();
    for (const k of ['subtitle', 'visibility', 'metadata', 'experience_date', 'title', 'entity_id']) {
      expect(r.payload).not.toHaveProperty(k);
    }
  });
});

/* ------------------------------- server results ------------------------------- */

describe('server results', () => {
  it('maps typed timeline statuses', () => {
    expect(fromTimelineStatus('not_latest')).toEqual({ status: 'not_latest' });
    expect(fromTimelineStatus('weird').status).toBe('error');
  });
  it('duplicate review and closed window come from the existing helpers', () => {
    expect(fromCreateReviewError({ code: '23505', message: 'reviews_one_per_user_entity' }, 'r9')).toEqual({ status: 'existing_review', reviewId: 'r9' });
    expect(fromCreateReviewError({ code: '23505', message: 'other_constraint' }).status).toBe('error');
    expect(fromUpdateReviewError({ message: 'review_edit_window_closed' })).toEqual({ status: 'expired' });
    expect(fromUpdateReviewError(new Error('boom')).status).toBe('error');
  });
  it('unknown errors stay errors', () => {
    expect(toBlockedReason({ status: 'error' })).toBeNull();
    expect(toBlockedReason({ status: 'conflict' })).toBeNull();
  });
});

/* ---------------------------------- evidence ---------------------------------- */

const deps = (over: Partial<ReconcileDeps> = {}): ReconcileDeps => ({
  findOwnReview: async () => ({ status: 'none' }),
  loadReview: async () => null,
  loadUpdate: async () => null,
  loadLatestUpdate: async () => null,
  ...over,
});

describe('ambiguous-save evidence', () => {
  it('new review found → strong candidate', async () => {
    const e = await gatherAmbiguousSaveEvidence({ mode: 'create-review', entityId: 'e' }, deps({ findOwnReview: async () => ({ status: 'found', review: { id: 'r' } }) }));
    expect(e).toMatchObject({ status: 'candidate-found', strength: 'strong' });
  });
  it('new timeline update is only ever weak or not seen', async () => {
    const found = await gatherAmbiguousSaveEvidence({ mode: 'create-timeline-update', reviewId: 'r' }, deps({ loadLatestUpdate: async () => storedUpdate() }));
    expect(found).toMatchObject({ status: 'candidate-found', strength: 'weak' });
    const none = await gatherAmbiguousSaveEvidence({ mode: 'create-timeline-update', reviewId: 'r' }, deps());
    expect(none.status).toBe('not-observed');
  });
  it('edit compares the exact record', async () => {
    const e = await gatherAmbiguousSaveEvidence(
      { mode: 'edit-timeline-update', reviewId: 'r1', updateId: 'up1', attempt: { comment: 'Still good' } },
      deps({ loadUpdate: async () => storedUpdate() }),
    );
    expect(e).toMatchObject({ strength: 'compare', matchesAttempt: true });
  });
  it('lookup failure is reported and does not change the form', async () => {
    const e = await gatherAmbiguousSaveEvidence({ mode: 'edit-review', reviewId: 'r' }, deps({ loadReview: async () => { throw new Error('x'); } }));
    expect(e.status).toBe('lookup-failed');
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-timeline-update' });
    s = composerReducer(composerReducer(s, { type: 'SAVE_STARTED', sessionKey: 'k' }), { type: 'SAVE_TIMEOUT', sessionKey: 'k' });
    const after = composerReducer(s, { type: 'EVIDENCE', sessionKey: 'k', evidence: e });
    expect(after.status).toBe('ambiguous');
    expect(after.values).toEqual(s.values);
  });
});

/* ------------------------------- upload session ------------------------------- */

describe('upload session (pure)', () => {
  it('cleanup lists only this session’s uploads, never pre-existing ones', () => {
    let s = createUploadSession('k', 'id');
    s = uploadSessionReducer(s, { type: 'UPLOADED', key: 'k', url: 'new' });
    expect(cleanupCandidates(s, ['old'])).toEqual(['new']);
    expect(cleanupCandidates(uploadSessionReducer(s, { type: 'UPLOADED', key: 'k', url: 'old' }), ['old'])).toEqual(['new']);
  });
  it('nothing is cleaned while saving, ambiguous, or after commit', () => {
    let s = uploadSessionReducer(createUploadSession('k'), { type: 'UPLOADED', key: 'k', url: 'u' });
    expect(cleanupCandidates(uploadSessionReducer(s, { type: 'SAVING' }))).toEqual([]);
    expect(cleanupCandidates(uploadSessionReducer(s, { type: 'AMBIGUOUS' }))).toEqual([]);
    expect(cleanupCandidates(uploadSessionReducer(s, { type: 'COMMITTED' }))).toEqual([]);
    s = uploadSessionReducer(uploadSessionReducer(s, { type: 'SAVING' }), { type: 'SAVE_FAILED' });
    expect(cleanupCandidates(s)).toEqual(['u']);
  });
});

/* --------------------------------- boundary --------------------------------- */

const ROOT = join(process.cwd(), 'src');
const MODULE = join(ROOT, 'components', 'review-composer');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe('module boundary', () => {
  it('only the gated review page uses the module', () => {
    const offenders = walk(ROOT)
      .filter((f) => !f.startsWith(MODULE))
      .filter((f) => /review-composer/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f))
      // 3B: only the gated review page and its own tests may use the module.
      .filter((f) => !/pages[\\/](ReviewComposerPage|__tests__[\\/]reviewComposerPage)/.test(f));
    expect(offenders).toEqual([]);
  });
  it('the composer module never parses error text', () => {
    const offenders = walk(MODULE)
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => /\.message\b|\.includes\(\s*['"`]/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
  it('every section id has a definition', () => {
    for (const id of SECTION_IDS) expect(SECTIONS[id].id).toBe(id);
  });
});
