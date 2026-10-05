/**
 * Walks the mode's configured steps. Only `enabled` sections validate; inert
 * (mode-disabled / subject-incompatible) sections never block or show errors.
 * Sections on other steps are `not-rendered` but still active, so they are
 * validated on submit and kept in the values.
 */
import { getCapabilities } from './modes';
import { sectionAvailability, validateSection, type SectionAvailability } from './sections';
import { sectionContextOf, type ComposerState } from './store';
import type { SectionId } from './values';

export interface StepValidation {
  ok: boolean;
  errors: Partial<Record<SectionId, string | null>>;
  /** First invalid section id — the screen moves focus to it. */
  firstInvalid: SectionId | null;
}

export function stepCount(state: ComposerState): number {
  return getCapabilities(state.mode).steps.length;
}

export function sectionsOnStep(
  state: ComposerState,
  stepIndex: number,
): { id: SectionId; availability: SectionAvailability }[] {
  const caps = getCapabilities(state.mode);
  const ctx = sectionContextOf(state);
  const onStep = new Set<SectionId>(caps.steps[stepIndex] ?? []);
  const all = caps.steps.flat() as SectionId[];
  return all.map((id) => {
    const base = sectionAvailability(id, ctx);
    return { id, availability: base === 'enabled' && !onStep.has(id) ? 'not-rendered' : base };
  });
}

function validateIds(state: ComposerState, ids: readonly SectionId[]): StepValidation {
  const ctx = sectionContextOf(state);
  const errors: Partial<Record<SectionId, string | null>> = {};
  let firstInvalid: SectionId | null = null;
  for (const id of ids) {
    if (sectionAvailability(id, ctx) !== 'enabled') continue;
    const err = validateSection(id, ctx);
    errors[id] = err;
    if (err && !firstInvalid) firstInvalid = id;
  }
  return { ok: firstInvalid === null, errors, firstInvalid };
}

export function validateStep(state: ComposerState, stepIndex: number): StepValidation {
  return validateIds(state, getCapabilities(state.mode).steps[stepIndex] ?? []);
}

export function validateForSubmit(state: ComposerState): StepValidation {
  return validateIds(state, getCapabilities(state.mode).steps.flat() as SectionId[]);
}

export function nextStep(state: ComposerState, stepIndex: number): { stepIndex: number; validation: StepValidation } {
  const validation = validateStep(state, stepIndex);
  if (!validation.ok) return { stepIndex, validation };
  return { stepIndex: Math.min(stepIndex + 1, stepCount(state) - 1), validation };
}
