import { describe, it, expect } from 'vitest';
import { attributeRatingKey } from '@/components/profile/reviews/questionnaire/envelope';
import { ATTRIBUTE_RATINGS_FIELD_ID } from '@/components/profile/reviews/questionnaire/registry';
const K = (id: string) => attributeRatingKey(ATTRIBUTE_RATINGS_FIELD_ID, id);

import { composerReducer, initialComposerState } from '../store';

describe('Phase 7B draft reset on subject change', () => {
  it('switching to another entity of the same type clears working attribute ratings', () => {
    const A = { id: 'e-a', name: 'Burger A', type: 'food' } as const;
    const B = { id: 'e-b', name: 'Burger B', type: 'food' } as const;
    let s = initialComposerState({ sessionKey: 'k', mode: 'create-review' });
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: { ...A } });
    s = composerReducer(s, { type: 'SET_QUESTIONNAIRE_CHOICE', sessionKey: 'k', fieldId: K('texture'), value: '4' });
    expect(s.values.questionnaire.choices[K('texture')]).toBe('4');
    expect(s.questionnaireTouched).toContain(K('texture'));
    s = composerReducer(s, { type: 'SUBJECT_CHANGED', sessionKey: 'k', subject: { ...B } });
    expect(s.values.questionnaire.choices[K('texture')]).toBeUndefined();
    expect(s.questionnaireTouched).toEqual([]);
  });
});
