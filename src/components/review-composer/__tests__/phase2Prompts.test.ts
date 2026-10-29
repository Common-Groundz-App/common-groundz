import { describe, it, expect } from 'vitest';
import { neutralRatingFeedback, thoughtsPromptFor, THOUGHTS_PROMPTS } from '../prompts';
import { CANONICAL_ENTITY_TYPES } from '@/services/entityType';
import { WOULD_RECOMMEND_FIELD, QUESTIONNAIRE_REGISTRY } from '@/components/profile/reviews/questionnaire/registry';

describe('Phase 2 composer copy', () => {
  it('every canonical type has a prompt', () => {
    for (const t of CANONICAL_ENTITY_TYPES) expect(THOUGHTS_PROMPTS[t]?.label).toBeTruthy();
  });
  it('specific wording', () => {
    expect(thoughtsPromptFor('book')).toEqual({ label: 'How was the read?', placeholder: 'What stood out to you? Anything people should know?' });
    expect(thoughtsPromptFor('product').label).toBe('How was it in real use?');
    expect(thoughtsPromptFor(null).placeholder).toBe('Share your experience and anything worth knowing.');
  });
  it('neutral rating feedback 0–5', () => {
    expect([0, 1, 2, 3, 4, 5].map(neutralRatingFeedback)).toEqual([
      'Tap the rings to share your rating.', "What didn't work for you?", 'What could have been better?',
      "What worked, and what didn't?", 'What did you like about it?', 'What made it stand out?',
    ]);
  });
  it('elevated recommendation is the registry field itself', () => {
    const f = QUESTIONNAIRE_REGISTRY.movie.sections[0].fields[0];
    expect(f).toBe(WOULD_RECOMMEND_FIELD);
    expect(f.options?.map((o) => o.value)).toEqual(['yes', 'maybe', 'no']);
  });
});
