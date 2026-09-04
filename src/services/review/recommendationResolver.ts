/**
 * TypeScript mirror of the SQL recommendation resolver.
 *
 * The database owns the materialized `reviews.is_recommended` flag. This module
 * exists so client code can display the *same* answer the database derived,
 * without ever writing that flag itself.
 *
 * It is a deliberate line-by-line mirror of two SQL objects:
 *
 *   public.lookup_latest_recommendation_intent(uuid)  -> ordering only
 *   public.resolve_review_recommendation(jsonb, text, text, numeric)
 *
 * Both sides are proven equivalent by ONE machine-readable fixture,
 * `__fixtures__/recommendationTruthTable.json`, which is executed by the Vitest
 * suite here and by the SQL harness. There is no second copy of the cases: if
 * the two implementations ever drift, the shared fixture fails on one side.
 *
 * Frozen output contract:
 *   source ∈ 'timeline_explicit' | 'review_explicit' | 'rating_inferred'
 *   a latest `auto` event resolves to { intent: null, source: 'rating_inferred' } —
 *   `auto` is historical event data, never resolved intent.
 */

/** Explicit intents a user can record. `auto` is an event value, not an intent. */
export type RecommendationIntent = 'yes' | 'maybe' | 'no';

/** Values the `review_updates.would_recommend` column may hold. */
export type TimelineIntentValue = RecommendationIntent | 'auto';

export type RecommendationSource =
  | 'timeline_explicit'
  | 'review_explicit'
  | 'rating_inferred';

export interface ResolvedRecommendation {
  /** Explicit intent, or null when the answer was inferred from the rating. */
  intent: RecommendationIntent | null;
  source: RecommendationSource;
  isRecommended: boolean;
}

/** Minimal shape needed to order timeline events. */
export interface TimelineIntentEvent {
  id: string;
  created_at: string;
  would_recommend?: TimelineIntentValue | null;
}

/** The rating threshold at or above which a review is inferred as recommended. */
export const RECOMMENDATION_RATING_THRESHOLD = 4;

const EXPLICIT_INTENTS: readonly string[] = ['yes', 'maybe', 'no'];

function isExplicitIntent(value: unknown): value is RecommendationIntent {
  return typeof value === 'string' && EXPLICIT_INTENTS.includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Ordering helper only — the SQL side is
 * `ORDER BY created_at DESC, id DESC LIMIT 1` over rows whose `would_recommend`
 * is not null. It makes no decision; it just picks the newest recorded event.
 *
 * Returns `null` when the review has no intent-bearing timeline event.
 */
export function lookupLatestRecommendationIntent(
  updates: readonly TimelineIntentEvent[] | null | undefined,
): TimelineIntentValue | null {
  if (!updates || updates.length === 0) return null;

  const candidates = updates.filter(
    (u) => u && u.would_recommend !== null && u.would_recommend !== undefined,
  );
  if (candidates.length === 0) return null;

  const newest = candidates.reduce((best, current) => {
    const byTime =
      Date.parse(current.created_at) - Date.parse(best.created_at);
    if (byTime > 0) return current;
    if (byTime < 0) return best;
    // Deterministic tie-break, identical to SQL's `id DESC` (text ordering of
    // the uuid). Same-timestamp inserts must never resolve at random.
    return current.id > best.id ? current : best;
  });

  return (newest.would_recommend as TimelineIntentValue) ?? null;
}

/**
 * Reads the review's own questionnaire answer, applying the exact strictness of
 * the SQL extraction: plain object, `version` exactly 1, `type` strictly equal
 * to the review's canonical category (the same value the DB stores in
 * `reviews.category`), `answers` a plain object, `would_recommend` exactly
 * yes/maybe/no.
 *
 * Anything malformed is ABSENT, never `false` — a broken envelope must not be
 * read as "the user said no".
 */
function readEnvelopeIntent(
  envelope: unknown,
  category: string | null | undefined,
): RecommendationIntent | null {
  if (!isPlainObject(envelope)) return null;
  // Mirrors SQL's strict numeric-version check:
  // jsonb_typeof(p_envelope->'version') = 'number' AND (p_envelope->>'version')::numeric = 1
  // A string "1" is malformed and must be treated as absent, never as a valid v1 answer.
  const version = envelope.version;
  if (typeof version !== 'number' || version !== 1) return null;
  if (typeof envelope.type !== 'string' || !category) return null;
  if (envelope.type !== category) return null;
  if (!isPlainObject(envelope.answers)) return null;

  const candidate = envelope.answers.would_recommend;
  return isExplicitIntent(candidate) ? candidate : null;
}


/**
 * Pure resolver — precedence: latest timeline intent, then the review's own
 * envelope answer, then the effective rating.
 *
 * `effectiveRating` must be the same value the SQL side uses, i.e.
 * `COALESCE(latest_rating, rating)`; a null/undefined rating is treated as 0 and
 * therefore NOT recommended, mirroring `COALESCE(p_effective_rating, 0) >= 4`.
 */
export function resolveReviewRecommendation(
  envelope: unknown,
  category: string | null | undefined,
  latestTimelineIntent: TimelineIntentValue | string | null | undefined,
  effectiveRating: number | null | undefined,
): ResolvedRecommendation {
  const ratingInferred =
    (effectiveRating ?? 0) >= RECOMMENDATION_RATING_THRESHOLD;

  // 1. Latest explicit timeline intent wins.
  if (isExplicitIntent(latestTimelineIntent)) {
    return {
      intent: latestTimelineIntent,
      source: 'timeline_explicit',
      isRecommended: latestTimelineIntent === 'yes',
    };
  }

  // 1b. A latest `auto` discards earlier explicit intent and falls back to rating.
  if (latestTimelineIntent === 'auto') {
    return { intent: null, source: 'rating_inferred', isRecommended: ratingInferred };
  }

  // 2. The review's own envelope answer.
  const envelopeIntent = readEnvelopeIntent(envelope, category);
  if (envelopeIntent) {
    return {
      intent: envelopeIntent,
      source: 'review_explicit',
      isRecommended: envelopeIntent === 'yes',
    };
  }

  // 3. Rating fallback.
  return { intent: null, source: 'rating_inferred', isRecommended: ratingInferred };
}

/**
 * Review-aware wrapper: takes the review row plus its timeline events and does
 * the ordering + resolution in one call, so callers cannot accidentally skip the
 * timeline step and resolve from the envelope alone.
 */
export function resolveRecommendationForReview(
  review: {
    category?: string | null;
    metadata?: unknown;
    rating?: number | null;
    latest_rating?: number | null;
  } | null | undefined,
  updates?: readonly TimelineIntentEvent[] | null,
): ResolvedRecommendation {
  const metadata = isPlainObject(review?.metadata) ? review?.metadata : undefined;
  const envelope = metadata ? metadata.questionnaire : undefined;
  const effectiveRating = review?.latest_rating ?? review?.rating ?? null;

  return resolveReviewRecommendation(
    envelope,
    review?.category ?? null,
    lookupLatestRecommendationIntent(updates),
    effectiveRating,
  );
}
