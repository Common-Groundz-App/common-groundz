import { describe, it, expect } from 'vitest';
import {
  mapCanonicalToLegacyCategory,
  deriveSubjectPrefill,
} from '../subjectSelection';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';

describe('mapCanonicalToLegacyCategory', () => {
  it('maps every canonical type to a legacy category', () => {
    for (const type of CANONICAL_ENTITY_TYPES) {
      expect(['food', 'movie', 'book', 'place', 'product']).toContain(
        mapCanonicalToLegacyCategory(type),
      );
    }
  });

  it('groups screen content under movie and visitable things under place', () => {
    expect(mapCanonicalToLegacyCategory('tv_show')).toBe('movie');
    expect(mapCanonicalToLegacyCategory('experience')).toBe('place');
    expect(mapCanonicalToLegacyCategory('event')).toBe('place');
  });

  it('keeps `others` as a legitimate type mapped to product', () => {
    expect(mapCanonicalToLegacyCategory('others')).toBe('product');
  });
});

describe('deriveSubjectPrefill', () => {
  it('rejects unknown types instead of coercing them', () => {
    const result = deriveSubjectPrefill({ id: '1', name: 'Thing', type: 'wormhole' });
    expect(result.canonicalType).toBeNull();
    expect(result.category).toBeNull();
    expect(result.contentName).toBe('');
  });

  it('puts a food subject name into foodName and leaves venue for the parent lookup', () => {
    const result = deriveSubjectPrefill({ id: '1', name: 'Butter Chicken', type: 'food' });
    expect(result.category).toBe('food');
    expect(result.foodName).toBe('Butter Chicken');
    expect(result.contentName).toBe('');
    expect(result.venue).toBe('');
  });

  it('uses the formatted address as venue for google places', () => {
    const result = deriveSubjectPrefill({
      id: '1',
      name: 'Toit',
      type: 'place',
      api_source: 'google_places',
      metadata: { formatted_address: '298 100 Feet Rd, Bengaluru' },
    });
    expect(result.contentName).toBe('Toit');
    expect(result.venue).toBe('298 100 Feet Rd, Bengaluru');
  });

  it('maps a course subject to the product questionnaire', () => {
    const result = deriveSubjectPrefill({ id: '1', name: 'CS50', type: 'course' });
    expect(result.canonicalType).toBe('course');
    expect(result.category).toBe('product');
    expect(result.contentName).toBe('CS50');
  });
});
