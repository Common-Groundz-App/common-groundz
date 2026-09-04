import { describe, expect, it } from 'vitest';

import truthTable from '../__fixtures__/recommendationTruthTable.json';
import {
  lookupLatestRecommendationIntent,
  resolveRecommendationForReview,
  resolveReviewRecommendation,
  type TimelineIntentEvent,
} from '../recommendationResolver';

/**
 * These cases are NOT declared here. They live in
 * `__fixtures__/recommendationTruthTable.json`, the same file the SQL harness
 * executes against `public.resolve_review_recommendation`. One fixture, two
 * runners — drift between SQL and TypeScript cannot hide.
 */
describe('recommendation truth table (shared fixture)', () => {
  it('runs the full fixture, not a silently truncated subset', () => {
    expect(truthTable.contractVersion).toBe(1);
    expect(truthTable.resolverCases).toHaveLength(truthTable.expectedResolverCaseCount);
    expect(truthTable.orderingCases).toHaveLength(truthTable.expectedOrderingCaseCount);
  });

  for (const testCase of truthTable.resolverCases) {
    it(`resolver: ${testCase.name}`, () => {
      const result = resolveReviewRecommendation(
        testCase.envelope,
        testCase.category,
        testCase.latestIntent,
        testCase.effectiveRating,
      );
      expect(result).toEqual(testCase.expected);
    });
  }

  for (const testCase of truthTable.orderingCases) {
    it(`ordering: ${testCase.name}`, () => {
      const result = lookupLatestRecommendationIntent(
        testCase.updates as TimelineIntentEvent[],
      );
      expect(result).toBe(testCase.expected);
    });
  }
});

describe('lookupLatestRecommendationIntent guards', () => {
  it('treats null and undefined input as no intent', () => {
    expect(lookupLatestRecommendationIntent(null)).toBeNull();
    expect(lookupLatestRecommendationIntent(undefined)).toBeNull();
  });
});

describe('resolveRecommendationForReview wrapper', () => {
  const envelope = {
    version: 1,
    type: 'movie',
    answers: { would_recommend: 'no' },
  };

  it('prefers latest_rating over rating for inference, mirroring COALESCE', () => {
    expect(
      resolveRecommendationForReview({ category: 'movie', rating: 1, latest_rating: 5 }),
    ).toEqual({ intent: null, source: 'rating_inferred', isRecommended: true });

    expect(
      resolveRecommendationForReview({ category: 'movie', rating: 5, latest_rating: null }),
    ).toEqual({ intent: null, source: 'rating_inferred', isRecommended: true });
  });

  it('reads the envelope out of metadata.questionnaire', () => {
    expect(
      resolveRecommendationForReview({ category: 'movie', rating: 5, metadata: { questionnaire: envelope } }),
    ).toEqual({ intent: 'no', source: 'review_explicit', isRecommended: false });
  });

  it('lets a timeline event override the envelope', () => {
    const updates: TimelineIntentEvent[] = [
      { id: '00000000-0000-4000-8000-000000000001', created_at: '2026-01-01T00:00:00Z', would_recommend: 'yes' },
    ];
    expect(
      resolveRecommendationForReview(
        { category: 'movie', rating: 1, metadata: { questionnaire: envelope } },
        updates,
      ),
    ).toEqual({ intent: 'yes', source: 'timeline_explicit', isRecommended: true });
  });

  it('ignores unrelated metadata and a missing review entirely', () => {
    expect(
      resolveRecommendationForReview({ category: 'movie', rating: 4, metadata: { food_tags: ['spicy'] } }),
    ).toEqual({ intent: null, source: 'rating_inferred', isRecommended: true });

    expect(resolveRecommendationForReview(null)).toEqual({
      intent: null,
      source: 'rating_inferred',
      isRecommended: false,
    });
  });
});
