/**
 * Phase 2.4 — subject requirement policy for the review form.
 *
 * Pure module: no React, no network. Centralises the answer to one question:
 * for this review form instance, is it okay to publish without a linked subject?
 *
 * - New reviews (profile / global): always require a subject.
 * - New reviews opened from an entity page: subject is locked to that entity.
 * - Editing a review that was originally unlinked: legacy-optional, may stay unlinked.
 * - Editing a review that was originally linked: subject is required.
 *
 * `originalEntityId` must be scoped to the currently loaded review id so that
 * switching from one review to another in the same mounted form never leaks
 * the previous review's legacy status.
 */

export type SubjectRequirement = 'required' | 'legacy-optional' | 'locked';

interface SubjectRequirementInput {
  /** True when editing an existing review. */
  isEditMode: boolean;
  /** The entity_id that was persisted for the review being edited, if any. */
  originalEntityId: string | null | undefined;
  /** True when the form was opened from an entity page for a new review. */
  isFromEntityPage: boolean;
}

export function subjectRequirement({
  isEditMode,
  originalEntityId,
  isFromEntityPage,
}: SubjectRequirementInput): SubjectRequirement {
  if (isFromEntityPage) return 'locked';
  if (!isEditMode) return 'required';
  return originalEntityId ? 'required' : 'legacy-optional';
}

export function allowsMissingSubject(requirement: SubjectRequirement): boolean {
  return requirement === 'legacy-optional';
}

export function subjectRequirementLabel(requirement: SubjectRequirement): string {
  switch (requirement) {
    case 'locked':
      return 'linked to this subject';
    case 'required':
      return 'required';
    case 'legacy-optional':
      return 'optional';
    default:
      return 'required';
  }
}
