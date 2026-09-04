/**
 * Phase 3C Stage 2 — pure input rules for `CuratedTagSelector`.
 *
 * No React. The component is a thin shell over these functions so the caps,
 * normalization and grandfathering rules are unit-testable in the node suite.
 *
 * Frozen rules:
 * - 5 combined (selected + custom), max 3 custom, 40 characters each.
 * - NFC-normalized and trimmed before case-insensitive dedupe, while PRESERVING
 *   the user's casing. Never blank.
 * - Caps govern CREATION and MODIFICATION, not passive viewing. Stored values
 *   over the cap are displayed and preserved intact, never truncated.
 * - `FoodTagSelector` is exempt from all of this and is not routed through here.
 */
import { CURATED_TAG_LIMITS } from './vocabularies';

export interface CuratedTagAnswer {
  selected: string[];
  custom: string[];
}

export const EMPTY_CURATED_ANSWER: CuratedTagAnswer = { selected: [], custom: [] };

export function normalizeCustomTag(raw: string): string {
  return raw.normalize('NFC').trim();
}

function foldCase(value: string): string {
  return normalizeCustomTag(value).toLocaleLowerCase();
}

export function countCombined(answer: CuratedTagAnswer): number {
  return answer.selected.length + answer.custom.length;
}

/** Passive viewing is never blocked; this only gates NEW input. */
export function isAtCombinedCap(answer: CuratedTagAnswer): boolean {
  return countCombined(answer) >= CURATED_TAG_LIMITS.maxCombined;
}

export function isAtCustomCap(answer: CuratedTagAnswer): boolean {
  return answer.custom.length >= CURATED_TAG_LIMITS.maxCustom;
}

export type CuratedTagRejection =
  | 'blank'
  | 'too_long'
  | 'duplicate'
  | 'combined_cap'
  | 'custom_cap';

export interface CuratedTagMutation {
  answer: CuratedTagAnswer;
  changed: boolean;
  rejection?: CuratedTagRejection;
}

/** Toggling a curated chip. Removal always works, even while over the cap. */
export function toggleCuratedTag(
  answer: CuratedTagAnswer,
  value: string,
): CuratedTagMutation {
  if (answer.selected.includes(value)) {
    return {
      answer: { ...answer, selected: answer.selected.filter((v) => v !== value) },
      changed: true,
    };
  }
  if (isAtCombinedCap(answer)) {
    return { answer, changed: false, rejection: 'combined_cap' };
  }
  return { answer: { ...answer, selected: [...answer.selected, value] }, changed: true };
}

export function addCustomTag(answer: CuratedTagAnswer, raw: string): CuratedTagMutation {
  const value = normalizeCustomTag(raw);
  if (!value) return { answer, changed: false, rejection: 'blank' };
  if (value.length > CURATED_TAG_LIMITS.maxCustomLength) {
    return { answer, changed: false, rejection: 'too_long' };
  }
  const folded = foldCase(value);
  const existing = [...answer.custom, ...answer.selected].map(foldCase);
  if (existing.includes(folded)) {
    return { answer, changed: false, rejection: 'duplicate' };
  }
  if (isAtCustomCap(answer)) return { answer, changed: false, rejection: 'custom_cap' };
  if (isAtCombinedCap(answer)) return { answer, changed: false, rejection: 'combined_cap' };
  // The user's casing is preserved exactly as typed (after NFC + trim).
  return { answer: { ...answer, custom: [...answer.custom, value] }, changed: true };
}

export function removeCustomTag(answer: CuratedTagAnswer, value: string): CuratedTagMutation {
  if (!answer.custom.includes(value)) return { answer, changed: false };
  return { answer: { ...answer, custom: answer.custom.filter((v) => v !== value) }, changed: true };
}

export function rejectionMessage(rejection: CuratedTagRejection): string {
  switch (rejection) {
    case 'blank':
      return 'Type something first.';
    case 'too_long':
      return `Keep it under ${CURATED_TAG_LIMITS.maxCustomLength} characters.`;
    case 'duplicate':
      return "You've already added that one.";
    case 'custom_cap':
      return `You can add up to ${CURATED_TAG_LIMITS.maxCustom} of your own.`;
    case 'combined_cap':
      return `You can pick up to ${CURATED_TAG_LIMITS.maxCombined} in total.`;
  }
}

export function isEmptyCuratedAnswer(answer: CuratedTagAnswer | undefined): boolean {
  return !answer || countCombined(answer) === 0;
}
