/**
 * Review category BUCKETS — a search/filter projection over `reviews.category`.
 *
 * ⚠️ This is NOT the review taxonomy. The canonical taxonomy is the 15 entity
 * types (`@/services/entityType`) plus the questionnaire registry
 * (`components/profile/reviews/questionnaire/registry.ts`). These five buckets
 * exist only so that search, filter and aggregation surfaces — including the
 * Deno mirror at `supabase/functions/_shared/reviewCategoryBuckets.ts` — can
 * group historical and canonical rows into the coarse legacy sections users
 * still browse by.
 *
 * Phase 3D invariant: no review-authoring or questionnaire module may import
 * this file. If you need a review's shape or questions, use the registry.
 *
 * Pure module: no React, no network.
 */
import type { CanonicalEntityType } from '@/services/entityType';

/** The five coarse search/filter buckets. */
export type ReviewBucket = 'food' | 'movie' | 'book' | 'place' | 'product';


/**
 * Project a canonical entity type onto its search/filter bucket.
 *
 * Every one of the 15 canonical types is handled explicitly, so adding a new
 * canonical type is a compile error rather than a silent `product`.
 */
export function mapCanonicalToLegacyCategory(
  canonical: CanonicalEntityType,
): ReviewBucket {
  switch (canonical) {
    case 'food':
      return 'food';
    case 'movie':
      return 'movie';
    case 'tv_show':
      return 'movie';
    case 'book':
      return 'book';
    case 'place':
      return 'place';
    case 'experience':
      // Experiences are visited/attended → they group with places.
      return 'place';
    case 'event':
      return 'place';
    case 'product':
    case 'brand':
    case 'service':
    case 'professional':
    case 'course':
    case 'app':
    case 'game':
    case 'others':
      return 'product';
    default: {
      // Exhaustiveness guard — a new canonical type must be mapped explicitly.
      const never: never = canonical;
      return never;
    }
  }
}
