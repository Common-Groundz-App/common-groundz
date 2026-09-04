/**
 * Phase 3C Stage 2 — `CuratedTagSelector` input rules.
 *
 * Caps: 5 combined, max 3 custom, 40 characters. NFC-normalized and trimmed
 * before case-insensitive dedupe, preserving the user's casing. Caps govern
 * creation and modification, never passive viewing.
 */
import { describe, expect, it } from 'vitest';
import {
  addCustomTag,
  countCombined,
  isAtCombinedCap,
  isEmptyCuratedAnswer,
  removeCustomTag,
  toggleCuratedTag,
  type CuratedTagAnswer,
} from '@/components/profile/reviews/questionnaire/curatedTagInput';

const empty: CuratedTagAnswer = { selected: [], custom: [] };

describe('curated tag selection', () => {
  it('starts unanswered — nothing is preselected', () => {
    expect(isEmptyCuratedAnswer(empty)).toBe(true);
  });

  it('toggles a curated tag on and back off', () => {
    const on = toggleCuratedTag(empty, 'quiet');
    expect(on.answer.selected).toEqual(['quiet']);
    const off = toggleCuratedTag(on.answer, 'quiet');
    expect(off.answer.selected).toEqual([]);
  });

  it('caps combined selections at 5', () => {
    let answer: CuratedTagAnswer = empty;
    for (const v of ['a', 'b', 'c', 'd', 'e']) answer = toggleCuratedTag(answer, v).answer;
    expect(countCombined(answer)).toBe(5);
    const rejected = toggleCuratedTag(answer, 'f');
    expect(rejected.changed).toBe(false);
    expect(rejected.rejection).toBe('combined_cap');
  });

  it('allows deselecting while over the cap (grandfathered stored values)', () => {
    const overCap: CuratedTagAnswer = { selected: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], custom: [] };
    expect(isAtCombinedCap(overCap)).toBe(true);
    const result = toggleCuratedTag(overCap, 'c');
    expect(result.changed).toBe(true);
    expect(result.answer.selected).toEqual(['a', 'b', 'd', 'e', 'f', 'g']);
  });
});

describe('custom tags', () => {
  it('trims and preserves the user casing', () => {
    const result = addCustomTag(empty, '  Great Practical Effects  ');
    expect(result.answer.custom).toEqual(['Great Practical Effects']);
  });

  it('NFC-normalizes before storing', () => {
    // "é" as e + combining acute.
    const result = addCustomTag(empty, 'Cafe\u0301 vibes');
    expect(result.answer.custom).toEqual(['Café vibes']);
  });

  it('rejects blanks', () => {
    expect(addCustomTag(empty, '   ').rejection).toBe('blank');
  });

  it('rejects entries longer than 40 characters', () => {
    expect(addCustomTag(empty, 'x'.repeat(41)).rejection).toBe('too_long');
    expect(addCustomTag(empty, 'x'.repeat(40)).changed).toBe(true);
  });

  it('dedupes case-insensitively against custom and curated values', () => {
    const withCustom = addCustomTag(empty, 'Great Coffee').answer;
    expect(addCustomTag(withCustom, 'great coffee').rejection).toBe('duplicate');
    const withSelected: CuratedTagAnswer = { selected: ['quiet'], custom: [] };
    expect(addCustomTag(withSelected, 'Quiet').rejection).toBe('duplicate');
  });

  it('caps custom entries at 3 even when the combined cap is not reached', () => {
    let answer: CuratedTagAnswer = empty;
    for (const v of ['one', 'two', 'three']) answer = addCustomTag(answer, v).answer;
    const rejected = addCustomTag(answer, 'four');
    expect(rejected.changed).toBe(false);
    expect(rejected.rejection).toBe('custom_cap');
  });

  it('caps the combined total across curated and custom', () => {
    let answer: CuratedTagAnswer = { selected: ['a', 'b', 'c', 'd'], custom: [] };
    answer = addCustomTag(answer, 'mine').answer;
    expect(countCombined(answer)).toBe(5);
    expect(addCustomTag(answer, 'another').rejection).toBe('combined_cap');
  });

  it('removes a custom tag intact', () => {
    const answer = addCustomTag(empty, 'Great Coffee').answer;
    expect(removeCustomTag(answer, 'Great Coffee').answer.custom).toEqual([]);
  });
});
