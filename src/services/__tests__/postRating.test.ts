import { describe, expect, it } from 'vitest';
import { getValidReviewPostRating, isStructuredFieldsRecord } from '@/components/feed/utils/postRating';

describe('getValidReviewPostRating', () => {
  it.each([1, 4.5, 5])('accepts the valid numeric Review rating %s', (rating) => {
    expect(getValidReviewPostRating('review', { rating })).toBe(rating);
  });

  it.each([
    ['missing', {}],
    ['numeric string', { rating: '4' }],
    ['below range', { rating: 0 }],
    ['above range', { rating: 6 }],
    ['NaN', { rating: Number.NaN }],
    ['infinity', { rating: Number.POSITIVE_INFINITY }],
    ['null fields', null],
    ['array fields', [{ rating: 4 }]],
  ])('rejects %s', (_label, structuredFields) => {
    expect(getValidReviewPostRating('review', structuredFields)).toBeNull();
  });

  it.each(['experience', 'recommendation', 'comparison', 'question', 'tip'] as const)(
    'ignores a stray rating on %s posts',
    (postType) => {
      expect(getValidReviewPostRating(postType, { rating: 4 })).toBeNull();
    },
  );
});

describe('isStructuredFieldsRecord', () => {
  it('accepts plain JSON objects and rejects null and arrays', () => {
    expect(isStructuredFieldsRecord({ rating: 4 })).toBe(true);
    expect(isStructuredFieldsRecord(null)).toBe(false);
    expect(isStructuredFieldsRecord([])).toBe(false);
  });
});