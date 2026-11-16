import { describe, it, expect } from 'vitest';
import { composerReducer, initialComposerState, type ComposerState } from '../store';
import { buildCreateReviewPayload, buildEditReviewPayload } from '../saveBuilders';
import { MODES } from '../modes';
import { sectionAvailability } from '../sections';
import type { ComposerSubject, StoredReviewRecord } from '../values';
import { hasSpoilerFlag, supportsSpoilerToggle, applySpoilerFlag } from '@/utils/spoilers';

const MOVIE: ComposerSubject = { id: 'e-movie', name: 'Dune: Part Two', type: 'movie' };
const BOOK: ComposerSubject = { id: 'e-book', name: 'Dune', type: 'book' };
const FOOD: ComposerSubject = { id: 'e-food', name: 'Classic Burger', type: 'food', providerName: 'Truffles' };

const stored = (metadata: unknown): StoredReviewRecord => ({
  id: 'r1', user_id: 'u1', entity_id: 'e-book', category: 'book', title: 'Dune', venue: '',
  subtitle: 'Great', description: 'Loved it', rating: 4, media: [], visibility: 'public',
  experience_date: null, status: 'published', entity: BOOK, metadata,
});
const hydrated = (metadata: unknown) => {
  const s = initialComposerState({ sessionKey: 'k', mode: 'edit-review' });
  return composerReducer(s, { type: 'HYDRATED', sessionKey: 'k', record: { review: stored(metadata) } });
};
const set = (s: ComposerState, id: any, value: unknown) =>
  composerReducer(s, { type: 'SET_VALUE', sessionKey: s.sessionKey, id, value });
const ctxOf = (s: ComposerState) => ({ caps: MODES[s.mode], values: s.values, stored: s.stored, subjectOrigin: 'user-selected' as const });

describe('Phase 8B spoiler rules', () => {
  it('only Movie, TV Show, Book and Game support the toggle', () => {
    for (const t of ['movie', 'tv_show', 'book', 'game']) expect(supportsSpoilerToggle(t)).toBe(true);
    for (const t of ['food', 'place', 'product', 'course', 'others', null]) expect(supportsSpoilerToggle(t)).toBe(false);
  });
  it('strict hydration: only literal true counts', () => {
    expect(hasSpoilerFlag({ contains_spoilers: true })).toBe(true);
    for (const v of ['true', 1, 'yes', null, undefined, {}]) expect(hasSpoilerFlag({ contains_spoilers: v })).toBe(false);
    expect(hasSpoilerFlag(null)).toBe(false);
  });
  it('applySpoilerFlag keeps all other keys', () => {
    expect(applySpoilerFlag({ a: 1, contains_spoilers: true }, false)).toEqual({ a: 1 });
    expect(applySpoilerFlag({ a: 1 }, true)).toEqual({ a: 1, contains_spoilers: true });
  });
  it('timeline update modes have the toggle switched off', () => {
    expect(MODES['create-timeline-update'].sections.containsSpoilers).toBe('off');
    expect(MODES['edit-timeline-update'].sections.containsSpoilers).toBe('off');
  });
});

describe('Phase 8B composer', () => {
  it('create: enabled movie saves metadata.contains_spoilers = true', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: MOVIE });
    expect(sectionAvailability('containsSpoilers', ctxOf(s))).toBe('enabled');
    s = set(set(s, 'rating', 4), 'containsSpoilers', true);
    const r = buildCreateReviewPayload({ values: s.values, userId: 'u', subjectOrigin: 'user-selected', questionnaireTouched: new Set() });
    expect(r.ok && r.payload.metadata?.contains_spoilers).toBe(true);
  });
  it('create: toggle off writes no flag', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: MOVIE });
    const r = buildCreateReviewPayload({ values: set(s, 'rating', 4).values, userId: 'u', subjectOrigin: 'user-selected', questionnaireTouched: new Set() });
    expect(r.ok && r.payload.metadata && 'contains_spoilers' in r.payload.metadata).toBe(false);
  });
  it('switching subject resets the flag; food never saves it', () => {
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: MOVIE });
    s = set(s, 'containsSpoilers', true);
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: FOOD });
    expect(s.values.containsSpoilers).toBe(false);
    expect(sectionAvailability('containsSpoilers', ctxOf(s))).toBe('subject-incompatible');
    s = set(set(s, 'containsSpoilers', true), 'rating', 4);
    const r = buildCreateReviewPayload({ values: s.values, userId: 'u', subjectOrigin: 'user-selected', questionnaireTouched: new Set() });
    expect(r.ok && r.payload.metadata && 'contains_spoilers' in r.payload.metadata).toBe(false);
  });
  it('edit: hydrates true, unrelated edit preserves it and all other metadata', () => {
    const meta = { contains_spoilers: true, provenance: { source: 'x' }, questionnaire: { version: 1, type: 'book', answers: { future_key: 'keep' } } };
    let s = hydrated(meta);
    expect(s.values.containsSpoilers).toBe(true);
    s = set(s, 'rating', 2);
    const r = buildEditReviewPayload({ values: s.values, stored: s.stored, questionnaireTouched: new Set() });
    expect(r.ok && r.payload.metadata).toMatchObject(meta);
  });
  it('edit: clearing removes the key and keeps everything else', () => {
    let s = hydrated({ contains_spoilers: true, provenance: { source: 'x' } });
    s = set(s, 'containsSpoilers', false);
    const r = buildEditReviewPayload({ values: s.values, stored: s.stored, questionnaireTouched: new Set() });
    expect(r.ok && r.payload.metadata).toBeTruthy();
    if (!r.ok) return;
    expect(r.payload.metadata).not.toHaveProperty('contains_spoilers');
    expect(r.payload.metadata).toMatchObject({ provenance: { source: 'x' } });
  });
  it('edit: malformed legacy value hydrates as off', () => {
    expect(hydrated({ contains_spoilers: 'true' }).values.containsSpoilers).toBe(false);
  });
});
