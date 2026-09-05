/**
 * Phase 3D — the bucket projection lives in its own module now, explicitly
 * separated from review authoring. These mapping cases were relocated here from
 * the review-authoring tree when that module's tests were retired.
 *
 * The `frontend ↔ Deno bucket mapping parity` block below was merged in from
 * the deleted `src/components/profile/reviews/__tests__/
 * reviewCategoryBucketParity.test.ts` so that NOTHING under the review-authoring
 * tree imports the five-bucket compatibility module — production or test.
 * Edge functions cannot import from `src/`, so `supabase/functions/_shared/
 * reviewCategoryBuckets.ts` mirrors this mapping, and the parity block makes
 * the mirror enforced rather than aspirational: adding or changing a canonical
 * type on one side without the other fails here.
 */
import { describe, it, expect } from 'vitest';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import { mapCanonicalToLegacyCategory } from '@/services/reviewCategoryBuckets';
import {
  CANONICAL_TO_BUCKET,
  REVIEW_BUCKETS,
  expandBucketToCanonical,
  expandBucketsToCanonical,
  normalizeToReviewBucket,
} from '../../../supabase/functions/_shared/reviewCategoryBuckets';

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

describe('frontend ↔ Deno bucket mapping parity', () => {
  it('agrees on every canonical entity type', () => {
    for (const type of CANONICAL_ENTITY_TYPES) {
      expect(CANONICAL_TO_BUCKET[type]).toBe(mapCanonicalToLegacyCategory(type));
    }
  });

  it('covers exactly the canonical set — no extras, no gaps', () => {
    expect(Object.keys(CANONICAL_TO_BUCKET).sort()).toEqual([...CANONICAL_ENTITY_TYPES].sort());
  });

  it('reverse expansion is the exact inverse of the mapping', () => {
    for (const bucket of REVIEW_BUCKETS) {
      const expected = CANONICAL_ENTITY_TYPES.filter(
        (t) => CANONICAL_TO_BUCKET[t] === bucket,
      );
      const actual = expandBucketToCanonical(bucket).filter((v) =>
        (CANONICAL_ENTITY_TYPES as readonly string[]).includes(v),
      );
      expect(actual.sort()).toEqual([...expected].sort());
    }
  });

  it('reverse expansion keeps the legacy bucket value itself so old rows still match', () => {
    for (const bucket of REVIEW_BUCKETS) {
      expect(expandBucketToCanonical(bucket)).toContain(bucket);
    }
  });

  it('normalization is idempotent for canonical and legacy values', () => {
    for (const value of [...CANONICAL_ENTITY_TYPES, ...REVIEW_BUCKETS]) {
      const once = normalizeToReviewBucket(value);
      expect(once).not.toBeNull();
      expect(normalizeToReviewBucket(once)).toBe(once);
    }
  });

  it('drops unknown values instead of coercing them to product', () => {
    expect(normalizeToReviewBucket('spaceship')).toBeNull();
    expect(normalizeToReviewBucket(null)).toBeNull();
    expect(normalizeToReviewBucket(undefined)).toBeNull();
    // Expansion is deliberately pass-through for non-bucket values: an unknown
    // detected keyword must not silently become the whole `product` bucket.
    expect(expandBucketsToCanonical(['spaceship'])).toEqual(['spaceship']);
  });
});
