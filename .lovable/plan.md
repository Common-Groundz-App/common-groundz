# Phase 4.2B verification, then Phase 4.3 — retire the legacy recommendation layer (revision 2)

## Both reviews accepted; the live database settled the two blocking points

I queried `pg_constraint` and `pg_policies` before accepting anything:

- **The cleanup order in revision 1 was genuinely wrong.**
  `reviews_recommendation_id_fkey` is `FOREIGN KEY (recommendation_id) REFERENCES
  recommendations(id)` with **no delete action** — so it restricts. Deleting the 9 parents
  first would simply fail. The six audited review references must be cleared first.
- **Children of a legacy record cascade**, verified: `recommendation_likes`,
  `recommendation_saves` and `recommendation_comments` are all
  `ON DELETE CASCADE`, and `recommendation_comments.parent_id` is
  `ON DELETE SET NULL` (self-referencing replies). I will still delete children explicitly
  by audited ID so the affected-row counts are asserted rather than implied.
- **Nested comment interactions have no foreign key.** `comment_likes` only references
  `auth.users`; comment ↔ like association is polymorphic by `comment_type`. So legacy
  comment likes and mentions must be deleted by the audited comment ID set — a cascade
  would have left them orphaned. Same for `notifications`, which has no FK to the legacy
  records either.
- **Write freeze is warranted, confirmed.** Live INSERT policies still exist for
  `recommendations`, `recommendation_comments`, `recommendation_likes` and
  `recommendation_saves` (plus UPDATE/DELETE on some), and the generic comment RPCs still
  accept the legacy item type. Without a freeze, an old client or a direct API call could
  repopulate the tables between 4.3 and 4.5.
- **Notification mapping proof** (chatgpt's one addition) accepted as an explicit test.
- **Deployment gates and a controlled not-found during the transition** accepted.

## Verification: 4.2B.4 and all of 4.2B are complete

| Claim | Evidence |
|---|---|
| All eight v1 scoring routines gone | `pg_proc` returns none; both `has_network_recommendations` overloads and the single `get_network_entity_recommendations` gone |
| Live Circle routines untouched | both `get_aggregated_network_recommendations_discovery` overloads, `get_network_recommendations_discovery`, and the circle-count routines present |
| Retired relations gone | `recommendation_quality_scores`, `social_influence_scores`, `entity_stats_view` absent; `entities.trending_score` absent |
| No code leftovers | sweep finds no live reference to any retired object |
| Schedulers | exactly 5 cron jobs; one trending (hourly :20), one influence (daily 04:12), no browser scheduler |

Stale bookkeeping to fix: `roadmap.md` still leaves 4.2 unchecked (line 144) and 4.2B
unchecked and labelled "Not started" (line 163) although every subphase is ticked.

Observation, not a defect: all `trending_score_v2` values are 0 because the score is a
24-hour rolling window with no qualifying activity in the last day. Still open from 4.2B:
`discoveryService.getNewThisWeek`'s `average >= 4.0` branch, awaiting its own measurement.

## Governing rule for 4.3

Two unrelated concepts share the word:

- **legacy standalone content** — `public.recommendations` + `recommendation_likes` /
  `_saves` / `_comments` → retired now;
- **editorial recommendation post** — `posts.post_type = 'recommendation'` → untouched;
  it stays an ordinary post in feed, search, comments, likes and notifications.

Nothing is removed because a name contains "recommendation" — only because it reads the
legacy tables.

## Order of work, with gates

**0. Close the parents.** Tick 4.2 and 4.2B in `roadmap.md` and add the 4.3 tasks.

**Gate 1 — write freeze (tracked migration, before any deletion).** Revoke application
INSERT/UPDATE/DELETE on the four legacy tables and drop their write policies (SELECT stays
so the tombstone route and the audit can still read); rewrite `add_comment`,
`get_comments_with_profiles` and `increment_comment_count` as post-only, rejecting the
legacy item type. Recommendation *posts* keep working through the post branch unchanged.
Verify by attempting an authenticated legacy insert and seeing it refused.

**Gate 2 — client and Edge Function cutover** (detail route deliberately still alive):

- profile **Recs** tab and `ProfileRecommendations`
- feed branch: `hooks/feed/api/recommendations*` + interactions, `RecommendationFeedItem`,
  the `FeedItem` dispatch — feed becomes posts-only; recommendation posts unaffected
- search: `RecommendationResultItem`, its rendering in Search, and the legacy branch in
  `unified-search-v2` and `search-all`; posts stay searchable
- entity page: `entityService.fetchEntityRecommendations` and its three hook callers,
  `RecommendationCard`, and the dead `EntityDetailV2` branch in `EntityDetail`
- legacy CRUD/interaction helpers: `recommendation/crudOperations`, `fetchRecommendations`,
  `fetchRecommendationById`, `interactionOperations`, the legacy exports in
  `recommendationService.ts`, and the `recommendation_likes` read in
  `use-user-interactions-cache`
- `commentsService`'s legacy item type
- the legacy-table read in `enhancedUnifiedProfileService`'s network check (currently gated
  on `rating >= 4`) → review endorsements

**Gate 3 — prove production no longer touches legacy paths**, then capture the audit
snapshot: the exact 9 record IDs and, keyed to them, their comment IDs (including replies),
comment likes and mentions, likes, saves, referencing notifications, and the 6 reviews with
conversion markers. Written to `docs/verification/phase-4-3-legacy-layer-removal.md`
before anything is deleted.

**Gate 4 — one transactional cleanup, exact IDs only** (no `type = 'recommendation'`
predicate anywhere), in FK-safe order:

1. clear `reviews.recommendation_id` / `reviews.is_converted` for the 6 audited reviews
   (restricting FK — must precede the parent delete)
2. comment likes and mentions for the audited comment IDs
3. audited comments, then likes, then saves
4. notifications referencing the audited record IDs
5. the 9 records

Every step asserts its expected affected-row count; any mismatch rolls the whole
transaction back. Then assert zero remaining legacy rows and interactions.

**Gate 5 — remove the route and mappings last:** `/recommendations/:id`,
`RecommendationView`, `RecommendationContentViewer`, and the legacy mappings in
`notificationService` / `notificationDestination` (including the dead `/recommendation/`
rewrite), tests updated. Until this point the route returns the existing controlled
"content not available" state, never a crash. Also now remove `recommendations.image_url`
from both orphan-media reference sets, so the deleted records' images become collectable.

**Gate 6 — preservation and zero-dependency verification.** Prove unchanged:
`posts.post_type = 'recommendation'` rendering plus its comments and likes; **notifications
about recommendation-type posts still resolve through normal post destination handling**,
while only notifications targeting legacy records were removed; `reviews.is_recommended`;
the v4 "N recommending (M from circle)" header; the "Recommended by Your Circle" card;
who-to-follow `UserRecommendationCard`; `fallbackRecommendationService` and
`networkRecommendationService`; `ChatRecommendationCards`; `JourneyRecommendationCard`.
Then dependency sweep, tests, typecheck, build, evidence document, roadmap ticked.

Stop before Phase 4.4.

## Explicitly kept

The v4 entity page and its counts; all circle routines and the Circle card; every
suggestion engine and shared helper whose name merely contains "recommendation"; and the
tables, `recommendation_category`, the two review columns, remaining policies and indexes —
physical drops stay in Phase 4.5 after the 4.4 proof.

## Visible changes to expect

The Recs tab disappears from profiles, old recommendation entries stop appearing in the
feed, in search and on entity pages, and the 16 notifications about them are removed.
Reviews, ratings, recommending counts, circle counts, posts and recommendation-type posts
are unaffected.

## Technical notes

Two tracked migrations in 4.3 — the write freeze (policies, grants, RPC bodies) and the
transactional data cleanup with pre-captured IDs and asserted post-conditions. No table,
enum or column is dropped. Review marker columns are cleared, not dropped, so 4.4 can prove
zero dependency before 4.5 removes them.
