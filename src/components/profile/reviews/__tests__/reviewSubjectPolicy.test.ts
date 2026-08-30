import { describe, expect, it } from 'vitest';
import {
  allowsMissingSubject,
  subjectRequirement,
  subjectRequirementLabel,
} from '../reviewSubjectPolicy';

describe('reviewSubjectPolicy', () => {
  it('requires a subject for new reviews', () => {
    expect(
      subjectRequirement({ isEditMode: false, originalEntityId: null, isFromEntityPage: false })
    ).toBe('required');
  });

  it('locks the subject when opened from an entity page', () => {
    expect(
      subjectRequirement({ isEditMode: false, originalEntityId: null, isFromEntityPage: true })
    ).toBe('locked');
  });

  it('requires a subject when editing a previously linked review', () => {
    expect(
      subjectRequirement({ isEditMode: true, originalEntityId: 'ent-123', isFromEntityPage: false })
    ).toBe('required');
  });

  it('makes the subject optional for legacy unlinked edits', () => {
    expect(
      subjectRequirement({ isEditMode: true, originalEntityId: null, isFromEntityPage: false })
    ).toBe('legacy-optional');
  });

  it('only legacy-optional allows missing subjects', () => {
    expect(allowsMissingSubject('legacy-optional')).toBe(true);
    expect(allowsMissingSubject('required')).toBe(false);
    expect(allowsMissingSubject('locked')).toBe(false);
  });

  it('produces readable labels', () => {
    expect(subjectRequirementLabel('locked')).toBe('linked to this subject');
    expect(subjectRequirementLabel('required')).toBe('required');
    expect(subjectRequirementLabel('legacy-optional')).toBe('optional');
  });
});
