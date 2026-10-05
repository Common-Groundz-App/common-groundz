/**
 * Composer modes and their capability rows.
 *
 * `entryType` × `operation` → exactly one mode. The table is exhaustive at
 * compile time; an unsupported runtime combination throws instead of silently
 * falling back to another mode.
 */
import type { SectionId } from './values';

export type EntryType = 'review' | 'timeline-update';
export type Operation = 'create' | 'edit';
export type ComposerMode =
  | 'create-review'
  | 'edit-review'
  | 'create-timeline-update'
  | 'edit-timeline-update';

/** `off` = the section does not exist in this mode (fully inert). */
export type Requirement = 'required' | 'optional' | 'off';

export interface ComposerCapabilities {
  mode: ComposerMode;
  entryType: EntryType;
  operation: Operation;
  sections: Record<SectionId, Requirement>;
  /** How the subject is presented. Timeline modes inherit the review's subject. */
  subject: 'select' | 'locked' | 'inherited';
  textKind: 'review' | 'what-changed';
  submitLabel: string;
  steps: readonly (readonly SectionId[])[];
}

const REVIEW_SECTIONS: Record<SectionId, Requirement> = {
  rating: 'required',
  subject: 'required',
  headline: 'optional',
  text: 'optional',
  media: 'optional',
  experienceDate: 'optional',
  questionnaire: 'optional',
  foodTags: 'optional',
  visibility: 'required',
  recommendation: 'off',
};

const TIMELINE_SECTIONS: Record<SectionId, Requirement> = {
  rating: 'optional',
  subject: 'off',
  headline: 'off',
  text: 'required',
  media: 'optional',
  experienceDate: 'off',
  questionnaire: 'off',
  foodTags: 'off',
  visibility: 'off',
  recommendation: 'optional',
};

const REVIEW_STEPS = [
  ['rating'],
  ['subject'],
  ['media'],
  ['headline', 'text', 'experienceDate', 'questionnaire', 'foodTags', 'visibility'],
] as const satisfies readonly (readonly SectionId[])[];

const TIMELINE_STEPS = [
  ['rating', 'recommendation', 'text', 'media'],
] as const satisfies readonly (readonly SectionId[])[];

export const MODES = {
  'create-review': {
    mode: 'create-review',
    entryType: 'review',
    operation: 'create',
    sections: REVIEW_SECTIONS,
    subject: 'select',
    textKind: 'review',
    submitLabel: 'Publish',
    steps: REVIEW_STEPS,
  },
  'edit-review': {
    mode: 'edit-review',
    entryType: 'review',
    operation: 'edit',
    sections: REVIEW_SECTIONS,
    subject: 'locked',
    textKind: 'review',
    submitLabel: 'Save changes',
    steps: REVIEW_STEPS,
  },
  'create-timeline-update': {
    mode: 'create-timeline-update',
    entryType: 'timeline-update',
    operation: 'create',
    sections: TIMELINE_SECTIONS,
    subject: 'inherited',
    textKind: 'what-changed',
    submitLabel: 'Add update',
    steps: TIMELINE_STEPS,
  },
  'edit-timeline-update': {
    mode: 'edit-timeline-update',
    entryType: 'timeline-update',
    operation: 'edit',
    sections: TIMELINE_SECTIONS,
    subject: 'inherited',
    textKind: 'what-changed',
    submitLabel: 'Save update',
    steps: TIMELINE_STEPS,
  },
} as const satisfies Record<ComposerMode, ComposerCapabilities>;

export class UnsupportedComposerModeError extends Error {
  constructor(entryType: unknown, operation: unknown) {
    super(`Unsupported composer mode: ${String(entryType)} / ${String(operation)}`);
    this.name = 'UnsupportedComposerModeError';
  }
}

export function resolveComposerMode(entryType: unknown, operation: unknown): ComposerCapabilities {
  if (entryType === 'review' && operation === 'create') return MODES['create-review'];
  if (entryType === 'review' && operation === 'edit') return MODES['edit-review'];
  if (entryType === 'timeline-update' && operation === 'create') return MODES['create-timeline-update'];
  if (entryType === 'timeline-update' && operation === 'edit') return MODES['edit-timeline-update'];
  throw new UnsupportedComposerModeError(entryType, operation);
}

export function getCapabilities(mode: ComposerMode): ComposerCapabilities {
  return MODES[mode];
}
