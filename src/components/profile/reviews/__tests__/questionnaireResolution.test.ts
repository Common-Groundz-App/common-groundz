import { describe, it, expect } from 'vitest';
import { resolveQuestionnaire, blocksSubmission } from '../questionnaire/resolve';
import { resolveReviewIdentity } from '../questionnaire/identityPersistence';
import { mergeReviewMetadata } from '../questionnaire/metadata';

describe('resolveQuestionnaire', () => {
  it('resolves a linked subject to its canonical questionnaire', () => {
    const r = resolveQuestionnaire({ entityId: 'e1', subjectType: 'food' });
    expect(r.mode).toBe('canonical');
    if (r.mode === 'canonical') expect(r.type).toBe('food');
  });

  it('treats a linked subject with an unparseable type as invalid, never product', () => {
    const r = resolveQuestionnaire({ entityId: 'e1', subjectType: 'restaurant-ish' });
    expect(r.mode).toBe('invalid');
    expect(blocksSubmission(r)).toBe(true);
  });

  it('treats a subject-less review as legacy-unlinked', () => {
    const r = resolveQuestionnaire({ entityId: '', subjectType: null });
    expect(r.mode).toBe('legacy-unlinked');
    expect(blocksSubmission(r)).toBe(false);
  });
});

describe('resolveReviewIdentity', () => {
  it('derives title and venue from the subject when the user picked it', () => {
    const id = resolveReviewIdentity({
      subjectOrigin: 'user-selected',
      subject: { name: 'Masala Dosa', type: 'food', venue: null, metadata: null },
      providerName: 'Rameshwaram Cafe',
      storedTitle: 'old title',
      storedVenue: 'old venue',
      legacyTitle: '',
      legacyVenue: '',
      isLegacyUnlinked: false,
    });
    expect(id.title).toBe('Masala Dosa');
    expect(id.venue).toBe('Rameshwaram Cafe');
  });

  it('preserves stored identity for an untouched loaded review', () => {
    const id = resolveReviewIdentity({
      subjectOrigin: 'loaded',
      subject: null,
      providerName: null,
      storedTitle: 'Historic title',
      storedVenue: 'Historic venue',
      legacyTitle: 'Historic title',
      legacyVenue: 'Historic venue',
      isLegacyUnlinked: false,
    });
    expect(id.title).toBe('Historic title');
    expect(id.venue).toBe('Historic venue');
  });

  it('uses the editable fields for a legacy-unlinked review', () => {
    const id = resolveReviewIdentity({
      subjectOrigin: 'loaded',
      subject: null,
      providerName: null,
      storedTitle: 'Old',
      storedVenue: 'Old venue',
      legacyTitle: 'Renamed',
      legacyVenue: 'Renamed venue',
      isLegacyUnlinked: true,
    });
    expect(id.title).toBe('Renamed');
    expect(id.venue).toBe('Renamed venue');
  });
});

describe('mergeReviewMetadata', () => {
  it('merges instead of replacing stored keys', () => {
    expect(mergeReviewMetadata({ provenance: 'x' }, { food_tags: ['a'] })).toEqual({
      provenance: 'x',
      food_tags: ['a'],
    });
  });

  it('ignores non-object stored metadata', () => {
    expect(mergeReviewMetadata('nope' as any, { food_tags: [] })).toEqual({ food_tags: [] });
  });

  it('returns undefined when there is nothing to store', () => {
    expect(mergeReviewMetadata(null, undefined)).toBeUndefined();
  });
});
