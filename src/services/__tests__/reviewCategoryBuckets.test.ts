/**
 * Phase 3D — the bucket projection lives in its own module now, explicitly
 * separated from review authoring. These tests moved here from the deleted
 * `subjectSelection.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import { mapCanonicalToLegacyCategory } from '@/services/reviewCategoryBuckets';

describe('mapCanonicalToLegacyCategory', () => {
  it('maps every canonical type to one of the five buckets', () => {
    for (const type of CANONICAL_ENTITY_TYPES) {
      expect(['food', 'movie', 'book', 'place', 'product']).toContain(
        mapCanonicalToLegacyCategory(type),
      );
    }
  });

  it('groups screen and visited types deliberately', () => {
    expect(mapCanonicalToLegacyCategory('tv_show')).toBe('movie');
    expect(mapCanonicalToLegacyCategory('experience')).toBe('place');
    expect(mapCanonicalToLegacyCategory('event')).toBe('place');
  });

  it('keeps `others` in the product bucket', () => {
    expect(mapCanonicalToLegacyCategory('others')).toBe('product');
  });
});
