/**
 * Phase 2.5A — strict display-type resolution for review cards.
 *
 * Hard rules:
 *
 * - NEVER invent `others`. `others` is a real, user-selectable canonical type.
 *   It may only appear here when the entity or the stored category genuinely
 *   said `others`. `getEntityTypeLabel` / `getEntityTypeFallbackImage` both
 *   fall back to `Others` internally, so they must only ever be called with an
 *   already-verified canonical value — never with a raw string or `''`.
 * - A failed or unattempted lookup is NOT evidence that a subject is missing.
 *   Those cases degrade to the stored category, never to `unavailable`.
 * - An unrecognised legacy string (`Travel`, `Music`, blank, null) yields
 *   `unknown`: the card simply shows no type badge rather than a wrong one.
 */

import { parseEntityType, type CanonicalEntityType } from '@/services/entityType';
import type { SubjectRelation } from '@/services/reviewSubjectRelation';

export type ReviewDisplayType =
  /** Linked review whose subject resolved to an active entity. */
  | { kind: 'canonical'; type: CanonicalEntityType }
  /** No trustworthy relation, but the stored category is a real canonical type. */
  | { kind: 'legacy'; type: CanonicalEntityType }
  /** Linked, the lookup succeeded, and the subject is gone or soft-deleted. */
  | { kind: 'unavailable' }
  /** Nothing reliable to show. */
  | { kind: 'unknown' };

const UNAVAILABLE: ReviewDisplayType = { kind: 'unavailable' };
const UNKNOWN: ReviewDisplayType = { kind: 'unknown' };

export interface ReviewDisplayTypeInput {
  entityId?: string | null;
  category?: string | null;
  subjectRelation?: SubjectRelation | null;
}

/** Stored category, but only when it is a genuine canonical type. */
function fromStoredCategory(category: string | null | undefined): ReviewDisplayType {
  const parsed = parseEntityType(category);
  return parsed ? { kind: 'legacy', type: parsed } : UNKNOWN;
}

export function resolveReviewDisplayType(review: ReviewDisplayTypeInput): ReviewDisplayType {
  const relation: SubjectRelation = review.subjectRelation ?? { status: 'not-loaded' };

  // 1. Unlinked legacy review — the stored category is the only truthful source.
  if (!review.entityId) {
    return fromStoredCategory(review.category);
  }

  switch (relation.status) {
    // 2 & 3. The lookup actually ran and returned something authoritative.
    case 'resolved': {
      if (relation.isDeleted) return UNAVAILABLE;
      const parsed = parseEntityType(relation.type);
      // A linked, live entity carrying an unparseable type is not a missing
      // subject — it is an unknown one. Do not claim it is unavailable.
      return parsed ? { kind: 'canonical', type: parsed } : UNKNOWN;
    }

    case 'absent':
      return UNAVAILABLE;

    // 4. Nothing is known. Degrade to the stored category, never to unavailable.
    case 'failed':
    case 'not-loaded':
    default:
      return fromStoredCategory(review.category);
  }
}

/**
 * The canonical type a card may safely pass to label / fallback-image helpers,
 * or `null` when there is nothing trustworthy to show.
 */
export function displayTypeValue(displayType: ReviewDisplayType): CanonicalEntityType | null {
  return displayType.kind === 'canonical' || displayType.kind === 'legacy' ? displayType.type : null;
}
