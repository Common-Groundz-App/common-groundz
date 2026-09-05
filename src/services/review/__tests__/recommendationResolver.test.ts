import { describe, expect, it } from 'vitest';

import truthTable from '../__fixtures__/recommendationTruthTable.json';
import {
  BASED_ON_RATING_EVENT_LABEL,
  BASE_ON_RATING_ACTION_LABEL,
  getRecommendationSourceCopy,
  getTimelineEntryRecommendationCopy,
  lookupLatestRecommendationIntent,
  RECOMMENDATION_INTENT_OPTIONS,
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

  it('regression: no timeline + null envelope answer keeps review_explicit no', () => {
    const updates: TimelineIntentEvent[] = [
      { id: '00000000-0000-4000-8000-000000000001', created_at: '2026-01-01T00:00:00Z', would_recommend: null },
    ];
    expect(
      resolveRecommendationForReview(
        { category: 'movie', rating: 5, metadata: { questionnaire: envelope } },
        updates,
      ),
    ).toEqual({ intent: 'no', source: 'review_explicit', isRecommended: false });
  });

  it('regression: latest auto discards the envelope and falls back to rating', () => {
    const updates: TimelineIntentEvent[] = [
      { id: '00000000-0000-4000-8000-000000000001', created_at: '2026-01-01T00:00:00Z', would_recommend: 'auto' },
    ];
    expect(
      resolveRecommendationForReview(
        { category: 'movie', rating: 5, metadata: { questionnaire: envelope } },
        updates,
      ),
    ).toEqual({ intent: null, source: 'rating_inferred', isRecommended: true });
  });
});

describe('getRecommendationSourceCopy', () => {
  it('renders timeline_explicit provenance', () => {
    expect(getRecommendationSourceCopy({ intent: 'yes', source: 'timeline_explicit', isRecommended: true })).toEqual({
      statement: 'Recommended',
      provenance: 'Based on your latest timeline update',
    });
  });

  it('renders review_explicit provenance', () => {
    expect(getRecommendationSourceCopy({ intent: 'no', source: 'review_explicit', isRecommended: false })).toEqual({
      statement: 'Not recommended',
      provenance: 'Based on your original answer',
    });
  });

  it('renders rating_inferred provenance', () => {
    expect(getRecommendationSourceCopy({ intent: null, source: 'rating_inferred', isRecommended: true })).toEqual({
      statement: 'Recommended',
      provenance: 'Based on your rating',
    });
  });

  it('renders maybe as a distinct statement', () => {
    expect(getRecommendationSourceCopy({ intent: 'maybe', source: 'timeline_explicit', isRecommended: false })).toEqual({
      statement: 'Maybe',
      provenance: 'Based on your latest timeline update',
    });
  });

  it('renders a null intent with no provenance claim when the caller lacks authoritative knowledge', () => {
    // The helper itself does not gate provenance; the caller passes an empty string.
    expect(getRecommendationSourceCopy({ intent: null, source: 'rating_inferred', isRecommended: false })).toEqual({
      statement: 'Not recommended',
      provenance: 'Based on your rating',
    });
  });
});

describe('getTimelineEntryRecommendationCopy', () => {
  it('renders explicit intents literally', () => {
    expect(getTimelineEntryRecommendationCopy('yes')).toBe('Recommended');
    expect(getTimelineEntryRecommendationCopy('maybe')).toBe('Maybe');
    expect(getTimelineEntryRecommendationCopy('no')).toBe('Not recommended');
  });

  it('renders auto with the event label', () => {
    expect(getTimelineEntryRecommendationCopy('auto')).toBe(BASED_ON_RATING_EVENT_LABEL);
  });

  it('renders null and undefined as empty', () => {
    expect(getTimelineEntryRecommendationCopy(null)).toBe('');
    expect(getTimelineEntryRecommendationCopy(undefined)).toBe('');
  });
});

describe('exported labels', () => {
  it('keeps the action and event labels distinct and non-empty', () => {
    expect(BASE_ON_RATING_ACTION_LABEL.length).toBeGreaterThan(0);
    expect(BASED_ON_RATING_EVENT_LABEL.length).toBeGreaterThan(0);
    expect(BASE_ON_RATING_ACTION_LABEL).not.toBe(BASED_ON_RATING_EVENT_LABEL);
  });

  it('exposes exactly the three allowed explicit intents', () => {
    expect(RECOMMENDATION_INTENT_OPTIONS.map(o => o.value)).toEqual(['yes', 'maybe', 'no']);
  });
});
