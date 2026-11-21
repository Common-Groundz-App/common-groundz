import { describe, expect, it } from 'vitest';
import { repeatIntentStatement } from '../questionnaire/repeatIntentStatement';

const MATRIX: Record<string, string> = {
  movie: 'watch again', book: 'read again', tv_show: 'keep watching', app: 'keep using',
  game: 'play again', experience: 'do again', food: 'order again', product: 'buy again',
  place: 'visit again', brand: 'buy from again', event: 'attend again', service: 'use again',
  professional: 'work with again', others: 'choose again',
};

describe('reader repeat-intent statements', () => {
  for (const [type, phrase] of Object.entries(MATRIX)) {
    it(`${type}: Would / Might / Wouldn't ${phrase}`, () => {
      expect(repeatIntentStatement(type, 'yes')).toBe(`Would ${phrase}`);
      expect(repeatIntentStatement(type, 'maybe')).toBe(`Might ${phrase}`);
      expect(repeatIntentStatement(type, 'no')).toBe(`Wouldn't ${phrase}`);
    });
  }
  it('course has no repeat statement', () => expect(repeatIntentStatement('course', 'yes')).toBeNull());
  it('missing or unknown answers return null', () => {
    expect(repeatIntentStatement('movie', null)).toBeNull();
    expect(repeatIntentStatement('movie', 'sometimes')).toBeNull();
    expect(repeatIntentStatement('unknown_type', 'yes')).toBeNull();
  });
});
