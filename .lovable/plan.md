# Phase 4.2B verification, then Phase 4.3 — retire the legacy recommendation layer (revised)

## Both reviews are right; all seven points are folded in

I checked each factual claim before accepting it:

- **Stale parent roadmap entries — confirmed.** `roadmap.md` line 144 still has 4.2
  unchecked and line 163 has 4.2B unchecked and labelled "Not started", while every
  subphase 4.2B.0–4.2B.4B is ticked with evidence. Closing both parents is now step 0.
- **Missing dependencies — confirmed, all eight exist.** `cleanup-orphan-media/index.ts`
  and `cleanup-orphan-media-execute/index.ts` read `recommendations.image_url` as a
  media-reference set; `add_comment.sql`, `get_comments_with_profiles.sql` and
  `increment_comment_count.sql` all branch on the legacy item type (and `add_comment.sql`
  still builds the dead `/recommendation/` link); `use-user-interactions-cache.ts` reads
  `recommendation_likes`; `services/recommendation/interactionOperations.ts` and
  `recommendationService.ts` still expose legacy like/CRUD helpers.
- **Route-first ordering is a broken-link window — accepted.** The route now goes last.
- **Overloaded name — accepted as the governing rule.** Nothing is removed because a
  string says "recommendation"; only because it reads `public.recommendations` or its
  child tables.
- **Exact-ID deletes, transactional and auditable — accepted.**
- **Preservation checks — accepted, as a named checklist.**

## Verification: 4.2B.4 and all of 4.2B are complete

Checked live, not from notes.

| Claim | Evidence |
|---|---|
| All eight v1 scoring routines gone | `pg_proc` returns none of them; both `has_network_recommendations` overloads and the single `get_network_entity_recommendations` are gone |
| Live Circle routines untouched | `get_aggregated_network_recommendations_discovery` (both overloads), `get_network_recommendations_discovery`, the circle-count routines all present |
| Retired relations gone | `recommendation_quality_scores`, `social_influence_scores`, `entity_stats_view` absent; `entities.trending_score` absent |
| No code leftovers | Sweep finds no live reference to any retired object |
| Schedulers | Exactly 5 cron jobs; one trending (:20 hourly), one influence (04:12 daily), no browser scheduler |

Observation, not a defect: every `trending_score_v2` is 0 right now because the score is a
24-hour rolling window with no qualifying activity in the last day; ordering-only consumers
and the recency fallback keep lists populated. Still deliberately open from 4.2B:
`discoveryService.getNewThisWeek`'s `average >= 4.0` branch, awaiting its own measurement.

## The governing rule for Phase 4.3

Two unrelated things share the word "recommendation":

- **legacy standalone content** — `public.recommendations` + `recommendation_likes` /
  `_saves` / `_comments` → retired now;
- **editorial recommendation post** — `posts.post_type = 'recommendation'` → untouched; it
  stays an ordinary post everywhere (feed, search, comments, likes, detail page).

Every deletion below is justified by a read of the legacy tables, never by a name.

## Order of work

**0. Close the parents.** Tick 4.2 and 4.2B in `roadmap.md`, replacing "Not started", and
add the four revised 4.3 tasks.

**1. Audit snapshot first.** Capture the exact 9 legacy record IDs and, keyed to them, the
counts and IDs of their comments, likes, saves and referencing notifications, plus the 6
reviews carrying conversion markers. Written to
`docs/verification/phase-4-3-legacy-layer-removal.md` before anything is deleted.

**2. Stop producing and surfacing legacy content** (route deliberately still alive):

- profile **Recs** tab and `ProfileRecommendations`
- feed branch: `hooks/feed/api/recommendations*` + its interactions, `RecommendationFeedItem`,
  and the `FeedItem` dispatch — the feed becomes posts-only, and recommendation *posts* keep
  flowing through the normal posts path unchanged
- search: `RecommendationResultItem`, its rendering in Search, and the `recommendations`
  branch in `unified-search-v2` and `search-all` — posts stay searchable as before
- entity page: `entityService.fetchEntityRecommendations` and its three hook callers,
  `RecommendationCard`, and the dead `EntityDetailV2` branch in `EntityDetail`
- legacy CRUD/interaction helpers: `services/recommendation/crudOperations`,
  `fetchRecommendations`, `fetchRecommendationById`, `interactionOperations`, the legacy
  exports in `recommendationService.ts`, and the `recommendation_likes` read in
  `use-user-interactions-cache`
- `commentsService`'s `'recommendation'` item type, and the legacy branches in
  `add_comment.sql`, `get_comments_with_profiles.sql`, `increment_comment_count.sql`
- the legacy-table read in `enhancedUnifiedProfileService`'s network check (currently
  gated on `rating >= 4`), switched to review endorsements
- `recommendations.image_url` from both orphan-media functions' reference sets — done after
  step 3 so the images of deleted records become collectable, and so 4.4 can prove zero
  dependency

**3. Controlled data cleanup**, one transaction, exact IDs only — no `type = 'recommendation'`
style predicate anywhere: notifications referencing the audited IDs → comments → likes →
saves → the 9 records → one `UPDATE` clearing `reviews.recommendation_id` and
`reviews.is_converted` for the 6 audited reviews. Report before/after counts and assert
zero remaining legacy rows or interactions.

**4. Remove the detail route last** — `/recommendations/:id`, `RecommendationView`,
`RecommendationContentViewer`, and the `'recommendation'` mappings in `notificationService`
and `notificationDestination` (including the dead `/recommendation/` rewrite), with their
tests updated. By this point no stored notification links there.

**5. Preservation verification** — explicitly prove each still behaves exactly as before:
`posts.post_type = 'recommendation'` renders and its comments/likes work; `reviews.is_recommended`
endorsement truth; the v4 "N recommending (M from circle)" header; the "Recommended by Your
Circle" card; who-to-follow `UserRecommendationCard`; `fallbackRecommendationService` and
`networkRecommendationService`; `ChatRecommendationCards` and `JourneyRecommendationCard`.

**6. Close out** — dependency sweep, tests, typecheck, build, evidence document, roadmap
ticked. Stop before Phase 4.4.

## Explicitly kept

The v4 entity page and its counts; all circle routines and the Circle card; every
suggestion engine and shared helper whose name merely contains "recommendation"; the
tables, `recommendation_category`, the two review columns and the remaining
policies/indexes — schema drops stay in Phase 4.5, after the 4.4 zero-dependency proof.

## Visible changes to expect

The Recs tab disappears from profiles, old recommendation entries stop appearing in the
feed, in search and on entity pages, and the 16 notifications about them are removed.
Reviews, ratings, recommending counts, circle counts, posts and recommendation-type posts
are unaffected.

## Technical notes

No schema migration in 4.3; the cleanup is a tracked, transactional data migration with
pre-captured IDs and post-conditions, not ad-hoc statements. Review marker columns are
cleared rather than dropped so 4.4 can prove zero dependency before 4.5 drops them.
