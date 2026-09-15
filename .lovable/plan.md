# Phase 4.2B verification, then Phase 4.3 — retire the legacy recommendation layer

## Verification: 4.2B.4 and all of 4.2B are complete

Checked against the live database and the code, not from notes.

| Claim | Evidence |
|---|---|
| All eight v1 scoring routines gone | `pg_proc` returns none of `calculate_trending_score`, `calculate_enhanced_trending_score`, `update_all_trending_scores`, `calculate_user_similarity`, `get_who_to_follow`, `get_personalized_entities`, `calculate_user_reputation`, `calculate_social_influence_score`; both `has_network_recommendations` overloads and the single `get_network_entity_recommendations` are gone |
| Live Circle routines untouched | `get_aggregated_network_recommendations_discovery` (both overloads) and `get_network_recommendations_discovery` still present; the entity header's "6 recommending (4 from circle)" path is unchanged |
| Retired relations gone | 0 rows in `pg_class` for `recommendation_quality_scores`, `social_influence_scores`, `entity_stats_view`; `entities.trending_score` no longer exists |
| No code leftovers | Repo-wide sweep finds no live reference to any retired object; remaining `trending_score` hits are the v2 RPC's own output field name |
| Schedulers | Exactly 5 cron jobs: stats v2 hourly (:05), trending v2 hourly (:20), influence v2 daily 04:12, orphan-media weekly dry run, retracted-notification prune — one trending, one influence, no browser scheduler |

4.2B.0 through 4.2B.4B are all ticked with evidence documents. One observation, not a
defect: every `trending_score_v2` is currently 0 because the score is a 24-hour rolling
window and there has been no qualifying activity in the last day. Ordering-only consumers
and the recency fallback keep lists populated, exactly as the contract intends.

Only one item stays deliberately open from 4.2B: `discoveryService.getNewThisWeek`'s
`count >= 2 OR average >= 4.0` condition, deferred for its own impact measurement.

## Phase 4.3 — remove the legacy standalone recommendation feature and its data

The old feature is a parallel content type (`public.recommendations` + its own likes,
saves and comments) that predates reviews. Endorsement truth has lived on reviews since
4.2A, so this layer feeds no count, rating, score or trust signal — it only still renders.
Live data: 9 records, 20 likes, 3 saves, 17 comments, 16 notifications pointing at them,
6 reviews carrying historical conversion markers.

### What is removed

Application surfaces:

- the `/recommendations/:id` route, `RecommendationView`, and `RecommendationContentViewer`
- the profile **Recs** tab and `ProfileRecommendations`
- the feed's recommendation branch: `hooks/feed/api/recommendations*`, its interaction
  helpers, `RecommendationFeedItem`, and the `FeedItem` dispatch to it — the feed becomes
  posts-only
- the search result type: `RecommendationResultItem`, its rendering in Search, and the
  `recommendations` branch in the `unified-search-v2` and `search-all` edge functions
- the entity page's legacy list: `entityService.fetchEntityRecommendations` and its
  callers in `use-entity-detail`, `use-entity-detail-cached`, `use-entity-data-cache`,
  plus `RecommendationCard` and the dead `EntityDetailV2` branch in `EntityDetail`
- `commentsService`'s `'recommendation'` item type and every table branch behind it
- the legacy read in `enhancedUnifiedProfileService`'s network check (it queries the old
  table with a `rating >= 4` gate); it switches to review endorsements, consistent with
  the rest of the platform
- the `'recommendation'` notification destination mapping in `notificationService` and
  `notificationDestination` (including the already-dead `/recommendation/` rewrite), with
  their tests updated

Data, in the same phase so no notification ever points at a missing page:

- delete the 16 legacy notifications, then the comments, likes and saves, then the 9 records
- clear `reviews.recommendation_id` and `reviews.is_converted` in one statement

### What is explicitly kept

- the v4 entity page and its "N recommending (M from circle)" header — review-derived,
  untouched
- `get_circle_recommendation_count`, `get_circle_recommendation_counts_batch`,
  `get_aggregated_network_recommendations_discovery`, `has_network_activity`, and the
  "Recommended by Your Circle" card
- everything named "recommendation" that is a *suggestion* engine, not the old content
  type: `UserRecommendationCard` (who to follow), `ChatRecommendationCards`,
  `JourneyRecommendationCard`, `fallbackRecommendationService`,
  `networkRecommendationService`, `hooks/recommendations/*` entity helpers, and the shared
  `services/recommendation/types.ts` entity types (renaming that module is cosmetic and
  stays out of scope)
- the tables, `recommendation_category`, the two review columns and the remaining
  routines/policies/indexes — schema drops are Phase 4.5, after the 4.4 zero-dependency
  sweep

### Order of work

1. Remove the route and page-level surfaces (route, view, profile tab, feed branch,
   search branch, entity list) so nothing can link to a record.
2. Remove the service-level readers and the comment/notification branches.
3. Redeploy the two edge functions with their recommendation branch removed.
4. Data cleanup in dependency order (notifications → comments/likes/saves → records →
   review marker columns), each step reporting affected row counts.
5. Re-run the dependency sweep, tests, typecheck and build; record evidence in
   `docs/verification/phase-4-3-legacy-layer-removal.md` and tick the roadmap.

### Visible changes to expect

The Recs tab disappears from profiles, old recommendation entries stop appearing in the
feed, in search and on entity pages, and the 16 notifications about them are removed.
Reviews, ratings, recommending counts, circle counts and posts are unaffected.

### Technical notes

No schema migration in 4.3 — deletes and one `UPDATE` only, run as data statements. The
review marker columns are cleared rather than dropped so 4.4 can prove zero dependencies
before 4.5 drops them. Stop at the end of 4.3 for verification before Phase 4.4.
