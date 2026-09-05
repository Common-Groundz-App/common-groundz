/**
 * Phase 3D — explicit compatibility regression acceptance.
 *
 * These are named acceptance cases rather than assumed coverage: Phase 3D
 * removed the form-level five-bucket state and the `SubjectPrefill` adapter, so
 * every compatibility behaviour that used to lean on them is asserted here.
 */
import { describe, it, expect } from 'vitest';
import { CANONICAL_ENTITY_TYPES, parseEntityTypeAtBoundary } from '@/services/entityType';
import {
  canonicalCategoryWins,
  resolvePersistedCategory,
} from '../categoryPersistence';
import { resolveQuestionnaire, blocksSubmission } from '../questionnaire/resolve';
import {
  isQuestionnaireWritable,
  readQuestionnaireEnvelope,
  QUESTIONNAIRE_VERSION,
} from '../questionnaire/envelope';
import { resolveReviewIdentity, deriveVenueSnapshot } from '../questionnaire/identityPersistence';
import { subjectRequirement, allowsMissingSubject } from '../reviewSubjectPolicy';

describe('category persistence truth table', () => {
  it('new review with a subject picked in the form writes the canonical type', () => {
    expect(
      resolvePersistedCategory({
        subjectOrigin: 'user-selected',
        isEditMode: false,
        canonicalCategory: 'course',
      }),
    ).toBe('course');
  });

  it('new review opened from an entity page writes the canonical type without re-selection', () => {
    expect(canonicalCategoryWins('entity-page', false)).toBe(true);
    expect(
      resolvePersistedCategory({
        subjectOrigin: 'entity-page',
        isEditMode: false,
        canonicalCategory: 'place',
      }),
    ).toBe('place');
  });

  it('new review with no valid subject resolves to null so the save is blocked', () => {
    expect(
      resolvePersistedCategory({
        subjectOrigin: 'none',
        isEditMode: false,
        canonicalCategory: null,
      }),
    ).toBeNull();
    // And it is never coerced into a legacy bucket.
    expect(
      resolvePersistedCategory({
        subjectOrigin: 'entity-page',
        isEditMode: false,
        canonicalCategory: null,
      }),
    ).toBeNull();
  });

  it('edit with a deliberately re-selected subject re-canonicalizes the category', () => {
    expect(
      resolvePersistedCategory({
        subjectOrigin: 'user-selected',
        isEditMode: true,
        canonicalCategory: 'movie',
        storedCategory: 'food',
      }),
    ).toBe('movie');
  });

  it('edit with an untouched subject preserves the stored raw category verbatim', () => {
    expect(
      resolvePersistedCategory({
        subjectOrigin: 'loaded',
        isEditMode: true,
        canonicalCategory: null,
        storedCategory: 'product',
      }),
    ).toBe('product');
    // Even an entity-page origin cannot rewrite an existing row.
    expect(canonicalCategoryWins('entity-page', true)).toBe(false);
  });

  it('legacy-unlinked edit preserves the stored raw category verbatim', () => {
    expect(
      resolvePersistedCategory({
        subjectOrigin: 'none',
        isEditMode: true,
        canonicalCategory: null,
        storedCategory: 'movie',
      }),
    ).toBe('movie');
  });
});

describe('legacy-unlinked editing stays possible', () => {
  it('keeps the historical title and venue editable and saves them', () => {
    const identity = resolveReviewIdentity({
      subjectOrigin: 'none',
      subject: null,
      storedTitle: 'Old Diner',
      storedVenue: 'Somewhere',
      legacyTitle: 'Old Diner (renamed)',
      legacyVenue: 'Main Street',
      isLegacyUnlinked: true,
    });
    expect(identity).toEqual({
      title: 'Old Diner (renamed)',
      venue: 'Main Street',
      source: 'legacy-editable',
    });
  });

  it('treats an unlinked edit as legacy-optional so it can be re-saved', () => {
    const requirement = subjectRequirement({
      isEditMode: true,
      originalEntityId: null,
      isFromEntityPage: false,
    });
    expect(requirement).toBe('legacy-optional');
    expect(allowsMissingSubject(requirement)).toBe(true);
  });
});

describe('compatibility mode on a category / subject-type mismatch', () => {
  it('withholds envelope writes while the stored category disagrees with the subject', () => {
    expect(isQuestionnaireWritable('food', 'place')).toBe(false);
    expect(isQuestionnaireWritable('place', 'place')).toBe(true);
  });

  it('exits compatibility mode once the subject is deliberately re-selected', () => {
    const persisted = resolvePersistedCategory({
      subjectOrigin: 'user-selected',
      isEditMode: true,
      canonicalCategory: 'place',
      storedCategory: 'food',
    });
    expect(persisted).toBe('place');
    expect(isQuestionnaireWritable(persisted, 'place')).toBe(true);
  });
});

describe('invalid subjects are blocked, never coerced', () => {
  it('blocks a new review whose linked subject type does not parse', () => {
    const resolution = resolveQuestionnaire({ entityId: 'e1', subjectType: 'wormhole' });
    expect(resolution.mode).toBe('invalid');
    expect(blocksSubmission(resolution)).toBe(true);
    expect(parseEntityTypeAtBoundary('wormhole')).toBeNull();
  });

  it('resolves a registry config directly for all 15 canonical types', () => {
    for (const type of CANONICAL_ENTITY_TYPES) {
      const resolution = resolveQuestionnaire({ entityId: 'e1', subjectType: type });
      expect(resolution.mode).toBe('canonical');
      if (resolution.mode === 'canonical') {
        expect(resolution.type).toBe(type);
        expect(resolution.config.sections.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('questionnaire version contract is permanent', () => {
  const envelope = (version: unknown) => ({
    questionnaire: { version, type: 'place', answers: { vibe: 'calm' } },
  });

  it('accepts the numeric current version', () => {
    expect(QUESTIONNAIRE_VERSION).toBe(1);
    const read = readQuestionnaireEnvelope(envelope(1), 'place');
    expect(read.status).toBe('v1');
  });

  it('treats a string version as absent, never as v1', () => {
    expect(readQuestionnaireEnvelope(envelope('1'), 'place').status).toBe('absent');
  });

  it('marks a future version incompatible and preserves it', () => {
    const read = readQuestionnaireEnvelope(envelope(2), 'place');
    expect(read.status).toBe('incompatible');
  });
});

describe('venue snapshot behaviour after the prefill adapter removal', () => {
  it('prefers a Google formatted address for places', () => {
    expect(
      deriveVenueSnapshot({
        type: 'place',
        venue: 'Ignored',
        metadata: { formatted_address: '12 Main St, Pune' },
      }),
    ).toBe('12 Main St, Pune');
  });

  it('takes a food venue from the resolved provider, never the dish name', () => {
    expect(deriveVenueSnapshot({ name: 'Butter Chicken', type: 'food' }, 'Punjabi Grill')).toBe(
      'Punjabi Grill',
    );
    expect(deriveVenueSnapshot({ name: 'Butter Chicken', type: 'food' }, null)).toBe('');
  });

  it('derives identity from the subject for a new entity-page review', () => {
    expect(
      resolveReviewIdentity({
        subjectOrigin: 'entity-page',
        subject: { name: 'CS50', type: 'course' },
        providerName: 'Harvard',
        isLegacyUnlinked: false,
      }),
    ).toEqual({ title: 'CS50', venue: 'Harvard', source: 'derived' });
  });

  it('preserves stored identity when an existing review is merely re-saved', () => {
    expect(
      resolveReviewIdentity({
        subjectOrigin: 'loaded',
        subject: { name: 'Renamed Entity', type: 'place' },
        storedTitle: 'Original Title',
        storedVenue: 'Original Venue',
        isLegacyUnlinked: false,
      }),
    ).toEqual({ title: 'Original Title', venue: 'Original Venue', source: 'preserved' });
  });
});
