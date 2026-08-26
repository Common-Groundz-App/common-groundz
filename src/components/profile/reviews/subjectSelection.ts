/**
 * Subject selection helpers for the review form (Phase 2.0).
 *
 * Step 2 no longer asks the user to pick an abstract category — it asks WHAT
 * they are reviewing. The legacy `category` field still drives Steps 3/4 and
 * persistence, so we derive it from the chosen subject's canonical type here.
 * This module is pure and unit-tested; no React, no network.
 */
import {
  parseEntityTypeAtBoundary,
  type CanonicalEntityType,
} from '@/services/entityType';

/** Legacy review categories understood by Steps 3/4 and reviewService. */
export type LegacyReviewCategory = 'food' | 'movie' | 'book' | 'place' | 'product';

/**
 * Map a canonical entity type onto the legacy review category.
 *
 * This is a TEMPORARY bridge: the questionnaire is still keyed by these five
 * buckets. Every one of the 15 canonical types is handled explicitly so adding
 * a new canonical type is a compile error rather than a silent `product`.
 */
export function mapCanonicalToLegacyCategory(
  canonical: CanonicalEntityType,
): LegacyReviewCategory {
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
      // Experiences are visited/attended → the place questionnaire fits best.
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

export interface SubjectLike {
  id: string;
  name: string;
  type: string;
  venue?: string;
  image_url?: string;
  description?: string;
  api_source?: string;
  metadata?: { formatted_address?: string } & Record<string, unknown>;
}

export interface SubjectPrefill {
  /** Canonical type of the subject. `null` = unparseable → not a valid subject. */
  canonicalType: CanonicalEntityType | null;
  /** Legacy category to drive Steps 3/4. `null` when the subject is invalid. */
  category: LegacyReviewCategory | null;
  /** Step 3 "what did you eat" value — only for food subjects. */
  foodName: string;
  /** Step 3 name value for every non-food subject. */
  contentName: string;
  /**
   * Best-effort venue. For food this stays EMPTY here: the venue comes from the
   * asynchronous parent lookup, so we must not overwrite it with the dish name.
   */
  venue: string;
}

/**
 * Derive all Step 3 field values from a selected subject.
 *
 * Unknown/unparseable types return `canonicalType: null` — they are never
 * coerced to `others` (a legitimate canonical type) or `product`.
 */
export function deriveSubjectPrefill(subject: SubjectLike): SubjectPrefill {
  const canonicalType = parseEntityTypeAtBoundary(subject.type);
  if (!canonicalType) {
    return {
      canonicalType: null,
      category: null,
      foodName: '',
      contentName: '',
      venue: '',
    };
  }

  const category = mapCanonicalToLegacyCategory(canonicalType);
  const name = subject.name || '';

  if (category === 'food') {
    // The dish IS the subject; the venue is resolved from its parent place.
    return { canonicalType, category, foodName: name, contentName: '', venue: '' };
  }

  if (category === 'place') {
    const venue =
      subject.api_source === 'google_places' && subject.metadata?.formatted_address
        ? subject.metadata.formatted_address
        : subject.venue || '';
    return { canonicalType, category, foodName: '', contentName: name, venue };
  }

  return {
    canonicalType,
    category,
    foodName: '',
    contentName: name,
    venue: subject.venue || '',
  };
}
