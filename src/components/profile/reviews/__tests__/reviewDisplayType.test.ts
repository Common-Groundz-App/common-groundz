import { describe, expect, it } from 'vitest';
import { displayTypeValue, resolveReviewDisplayType } from '../reviewDisplayType';
import {
  SUBJECT_RELATION_ABSENT,
  SUBJECT_RELATION_FAILED,
  SUBJECT_RELATION_NOT_LOADED,
} from '@/services/reviewSubjectRelation';

describe('resolveReviewDisplayType', () => {
  it('prefers a resolved canonical subject type over the stored category', () => {
    const result = resolveReviewDisplayType({
      entityId: 'ent-1',
      category: 'product',
      subjectRelation: { status: 'resolved', type: 'dish', isDeleted: false },
    });
    expect(result).toEqual({ kind: 'canonical', type: 'dish' });
  });

  it('falls back to a verified stored category when the subject lookup failed', () => {
    const result = resolveReviewDisplayType({
      entityId: 'ent-1',
      category: 'book',
      subjectRelation: SUBJECT_RELATION_FAILED,
    });
    expect(result).toEqual({ kind: 'legacy', type: 'book' });
  });

  it('falls back to the stored category while the subject is not loaded', () => {
    const result = resolveReviewDisplayType({
      entityId: 'ent-1',
      category: 'movie',
      subjectRelation: SUBJECT_RELATION_NOT_LOADED,
    });
    expect(result).toEqual({ kind: 'legacy', type: 'movie' });
  });

  it('reports unavailable for a resolved-but-soft-deleted subject, never inventing a type', () => {
    const result = resolveReviewDisplayType({
      entityId: 'ent-1',
      category: 'product',
      subjectRelation: { status: 'resolved', type: 'dish', isDeleted: true },
    });
    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('reports unavailable when the subject is confirmed absent', () => {
    const result = resolveReviewDisplayType({
      entityId: 'ent-1',
      category: 'product',
      subjectRelation: SUBJECT_RELATION_ABSENT,
    });
    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('reports unknown for a resolved subject with a non-canonical type', () => {
    const result = resolveReviewDisplayType({
      entityId: 'ent-1',
      category: 'food',
      subjectRelation: { status: 'resolved', type: 'not-a-real-type', isDeleted: false },
    });
    expect(result).toEqual({ kind: 'unknown' });
  });

  it('reports unknown for unlinked reviews with a non-canonical stored category', () => {
    const result = resolveReviewDisplayType({
      entityId: null,
      category: 'not-a-real-type',
      subjectRelation: SUBJECT_RELATION_NOT_LOADED,
    });
    expect(result).toEqual({ kind: 'unknown' });
  });

  it('never coerces anything to others', () => {
    const cases = [
      { entityId: null, category: 'weird', subjectRelation: SUBJECT_RELATION_NOT_LOADED },
      { entityId: 'e', category: 'weird', subjectRelation: SUBJECT_RELATION_ABSENT },
      { entityId: 'e', category: null, subjectRelation: SUBJECT_RELATION_NOT_LOADED },
    ] as const;
    for (const input of cases) {
      expect(displayTypeValue(resolveReviewDisplayType({ ...input } as any))).not.toBe('others');
    }
  });

  it('displayTypeValue only surfaces canonical and legacy types', () => {
    expect(displayTypeValue({ kind: 'canonical', type: 'dish' })).toBe('dish');
    expect(displayTypeValue({ kind: 'legacy', type: 'book' })).toBe('book');
    expect(displayTypeValue({ kind: 'unavailable' })).toBeNull();
    expect(displayTypeValue({ kind: 'unknown' })).toBeNull();
  });
});
