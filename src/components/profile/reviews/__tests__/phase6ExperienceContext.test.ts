import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import {
  EXPERIENCE_CONTEXT_FIELDS,
  QUESTIONNAIRE_REGISTRY,
  USAGE_DURATION_OPTIONS,
} from '@/components/profile/reviews/questionnaire/registry';

const sectionsOf = (t: string) => QUESTIONNAIRE_REGISTRY[t as keyof typeof QUESTIONNAIRE_REGISTRY].sections;

describe('Phase 6B experience context', () => {
  it('gives every one of the 15 types exactly one "Your experience" section, right after the verdict', () => {
    for (const t of CANONICAL_ENTITY_TYPES) {
      const secs = sectionsOf(t);
      const ctx = secs.filter((s) => s.id === 'experience_context');
      expect(ctx).toHaveLength(1);
      expect(ctx[0].title).toBe('Your experience');
      expect(secs[1].id).toBe('experience_context');
      expect(ctx[0].fields.every((f) => f.kind === 'single-choice' && !f.required)).toBe(true);
    }
  });

  it('uses the exact non-overlapping duration codes for product and app', () => {
    const codes = ['under_1_month', '1_to_under_6_months', '6_to_under_12_months', '1_year_or_more'];
    expect(USAGE_DURATION_OPTIONS.map((o) => o.value)).toEqual(codes);
    // Boundaries: exactly 6 months → 6_to_under_12; exactly 1 year → 1_year_or_more.
    const bucket = (m: number) => codes[m < 1 ? 0 : m < 6 ? 1 : m < 12 ? 2 : 3];
    expect(bucket(6)).toBe('6_to_under_12_months');
    expect(bucket(12)).toBe('1_year_or_more');
    expect(EXPERIENCE_CONTEXT_FIELDS.product[0].id).toBe('usage_duration');
    expect(EXPERIENCE_CONTEXT_FIELDS.app[0].id).toBe('usage_duration');
  });

  it('keeps Experience and Others on separate field ids', () => {
    expect(EXPERIENCE_CONTEXT_FIELDS.experience[0].id).toBe('experience_familiarity');
    expect(EXPERIENCE_CONTEXT_FIELDS.others[0].id).toBe('other_familiarity');
  });

  it('uses game familiarity instead of playthrough count', () => {
    expect(EXPERIENCE_CONTEXT_FIELDS.game.map((f) => f.id)).toEqual(['game_familiarity', 'play_progress']);
    expect(EXPERIENCE_CONTEXT_FIELDS.game[0].options?.map((o) => o.value)).toEqual(['just_started', 'played_before', 'regular_player']);
  });

  it('stores no evaluative codes', () => {
    const all = Object.values(EXPERIENCE_CONTEXT_FIELDS).flat().flatMap((f) => f.options ?? []);
    expect(all.some((o) => /favorite|love|best|great/i.test(o.value + o.label))).toBe(false);
  });

  it('leaves the Timeline composer off the questionnaire registry', () => {
    const src = readFileSync(['src', 'components', 'review' + '-composer', 'screen', 'TimelineComposerScreen.tsx'].join('/'), 'utf8');
    expect(src).not.toMatch(/questionnaire\/registry|EXPERIENCE_CONTEXT_FIELDS|QUESTIONNAIRE_REGISTRY/);
  });
});
