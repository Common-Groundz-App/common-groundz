/**
 * Phase 3D — the frozen `reviews.category` persistence truth table.
 *
 * Extracted from `ReviewForm` so the contract is unit-tested rather than
 * implied. There is no fallback: an unresolvable case returns `null`, and the
 * caller must BLOCK the save instead of inventing a category.
 *
 * | new review, subject picked in the form (`user-selected`) | canonical type   |
 * | new review opened from an entity page (`entity-page`)    | canonical type   |
 * | new review with no valid subject                         | null → blocked   |
 * | edit, subject deliberately re-selected (`user-selected`) | canonical type   |
 * | edit, subject untouched (`loaded`)                       | stored, verbatim |
 * | edit, legacy-unlinked                                    | stored, verbatim |
 *
 * Pure module: no React, no network.
 */
import type { CanonicalEntityType } from '@/services/entityType';

export type SubjectOrigin = 'none' | 'loaded' | 'entity-page' | 'user-selected';

export interface PersistedCategoryInput {
  subjectOrigin: SubjectOrigin;
  isEditMode: boolean;
  /** Canonical type of the currently linked subject, when it parsed. */
  canonicalCategory: CanonicalEntityType | null;
  /** The value already stored on the review being edited, if any. */
  storedCategory?: string | null;
}

/** True when the linked subject — not the stored row — is authoritative. */
export function canonicalCategoryWins(
  subjectOrigin: SubjectOrigin,
  isEditMode: boolean,
): boolean {
  return (
    subjectOrigin === 'user-selected' || (subjectOrigin === 'entity-page' && !isEditMode)
  );
}

export function resolvePersistedCategory({
  subjectOrigin,
  isEditMode,
  canonicalCategory,
  storedCategory,
}: PersistedCategoryInput): string | null {
  if (canonicalCategoryWins(subjectOrigin, isEditMode) && canonicalCategory) {
    return canonicalCategory;
  }
  if (isEditMode && storedCategory) return storedCategory;
  return null;
}
