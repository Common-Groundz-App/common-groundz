# Phase 4.2B verification, then Phase 4.3 — retire the legacy recommendation layer (revision 4)

## Revision 4: the trigger-order correction is right, and I confirmed it live

`on_delete_recommendation_like` fires `retract_recommendation_like_notification()` AFTER
DELETE on `recommendation_likes`, so deleting likes before notifications would retract
notifications as a trigger side effect and break the count assertion. Notifications now go
first in Gate 4, after a complete-cohort check. Gate 1's proof is also split into shared
routines (legacy input rejected, post input still succeeds, contract otherwise unchanged),
legacy-only routines (application execution denied) and `service_role` retention.

## Earlier accepted points, each confirmed live



- **The write freeze in revision 2 was incomplete — codex is right.** Thirteen `public`
  routines touch the legacy tables and **every one is SECURITY DEFINER and executable by
  `authenticated`** (most by `anon` too): `add_comment`, `update_comment`, `delete_comment`,
  `toggle_comment_like`, `toggle_recommendation_like`, `increment_comment_count`,
  `increment_recommendation_view`, `get_comments_with_profiles` (two overloads),
  `get_recommendation_likes_by_ids`, `get_user_recommendation_likes`,
  `create_recommendation_comment_notification`, `create_recommendation_like_notification`.
  Revoking table grants alone would leave every one of these able to write as its owner. The
  freeze now covers all of them.
- **Replayability — accepted.** Production UUIDs and `= 17` style assertions belong in an
  audited one-off operation, not in the replayable migration chain.
- **No raw user-linked IDs in the committed document — accepted.** The manifest stays out of
  the repo; the document carries counts, queries, evidence and a manifest checksum.
- **Audit snapshot content and service-role retention** (chatgpt) — accepted as written.

## Verification: 4.2B.4 and all of 4.2B are complete

| Claim | Evidence |
|---|---|
| All eight v1 scoring routines gone | `pg_proc` returns none; both `has_network_recommendations` overloads and the single `get_network_entity_recommendations` gone |
| Live Circle routines untouched | both `get_aggregated_network_recommendations_discovery` overloads, `get_network_recommendations_discovery`, and the circle-count routines present |
| Retired relations gone | `recommendation_quality_scores`, `social_influence_scores`, `entity_stats_view` absent; `entities.trending_score` absent |
| No code leftovers | sweep finds no live reference to any retired object |
| Schedulers | exactly 5 cron jobs; one trending (hourly :20), one influence (daily 04:12), no browser scheduler |

Bookkeeping to fix: `roadmap.md` still leaves 4.2 unchecked and 4.2B unchecked/"Not started"
though every subphase is ticked. Observation, not a defect: all `trending_score_v2` are 0
(24-hour rolling window, no qualifying activity in the last day). Still open from 4.2B:
`discoveryService.getNewThisWeek`'s `average >= 4.0` branch, awaiting measurement.

## Governing rule for 4.3

- **legacy standalone content** — `public.recommendations` + `recommendation_likes` /
  `_saves` / `_comments` → retired now;
- **editorial recommendation post** — `posts.post_type = 'recommendation'` → untouched;
  it stays an ordinary post in feed, search, comments, likes and notifications.

Nothing is removed for having "recommendation" in its name — only for reading the legacy
tables.

## Order of work, with gates

**0. Close the parents.** Tick 4.2 and 4.2B in `roadmap.md`; add the 4.3 tasks.

**Gate 1 — complete write freeze (portable, replayable migration).**

- revoke `anon`/`authenticated` INSERT/UPDATE/DELETE on the four legacy tables and drop
  their write policies; SELECT stays so the tombstone route and the audit can read
- **`service_role` keeps full DML** — it is the authority the Gate 4 cleanup runs under
- for each of the thirteen routines above: shared post/legacy routines (`add_comment`,
  `update_comment`, `delete_comment`, `toggle_comment_like`, `increment_comment_count`,
  `get_comments_with_profiles`) become **post-only**, rejecting the legacy item type;
  legacy-only routines (`toggle_recommendation_like`, `increment_recommendation_view`,
  `get_recommendation_likes_by_ids`, `get_user_recommendation_likes`, and the two legacy
  notification triggers' helpers) lose application EXECUTE
- proof, recorded in three separate categories so no impossible test is written: shared
  routines reject legacy input while the same call against a post still succeeds, with
  signatures, return shapes, ownership and grants otherwise unchanged; legacy-only routines
  deny application execution; `service_role` retains only what the Gate 4 cleanup needs


**Gate 2 — client and Edge Function cutover** (detail route deliberately still alive):

- profile **Recs** tab and `ProfileRecommendations`
- feed branch: `hooks/feed/api/recommendations*` + interactions, `RecommendationFeedItem`,
  the `FeedItem` dispatch — feed becomes posts-only; recommendation posts unaffected
- search: `RecommendationResultItem`, its rendering in Search, and the legacy branch in
  `unified-search-v2` and `search-all`; posts stay searchable
- entity page: `entityService.fetchEntityRecommendations` and its three hook callers,
  `RecommendationCard`, the dead `EntityDetailV2` branch in `EntityDetail`
- legacy helpers: `recommendation/crudOperations`, `fetchRecommendations`,
  `fetchRecommendationById`, `interactionOperations`, the legacy exports in
  `recommendationService.ts`, the `recommendation_likes` read in `use-user-interactions-cache`
- `commentsService`'s legacy item type
- the legacy-table read in `enhancedUnifiedProfileService`'s network check (`rating >= 4`
  gate) → review endorsements

**Gate 3 — prove deployed consumers no longer touch the legacy layer**, then capture the
audit manifest: the exact record IDs plus, for each, the dependent comment IDs (including
replies), comment likes and mentions, likes, saves, referencing notifications with their
target and type, the 6 reviews holding conversion markers, and each row's author, entity and
timestamps — enough to reconstruct what was deleted. The manifest is kept as a secured
artefact, **not committed**; the repository document records counts, the queries used,
execution evidence and the manifest checksum.

**Gate 4 — audited, transactional cleanup operation** (a one-off run against production, not
part of the replayable chain), exact IDs only. The order is trigger-aware: I inspected the
live triggers and `on_delete_recommendation_like` fires
`retract_recommendation_like_notification()` **AFTER DELETE** on `recommendation_likes`, so
deleting likes before notifications would silently retract notifications as a side effect and
make the notification count assertion fail. Notifications therefore go first:

I also read both retraction trigger bodies: each is a bare `UPDATE ... WHERE ...` setting
`retracted_at`, so with the notifications already deleted they match zero rows and no-op
safely. No trigger is disabled to get the cleanup through.

1. inside the transaction, take table-level locks on the four legacy tables plus row locks on
   the audited records and referenced reviews (blocking any concurrent `service_role` write),
   then confirm the manifest represents the **complete** current legacy cohort — otherwise
   "exact IDs only" and "zero rows afterwards" cannot both hold. A partial match or an
   unexpected extra legacy record aborts; a genuinely empty environment is a no-op

2. delete the audited notifications, both record and comment destinations
3. clear `reviews.recommendation_id` / `is_converted` for the audited reviews —
   `reviews_recommendation_id_fkey` has no delete action, so it restricts and must precede the
   parent delete
4. comment likes and mentions for the audited comment IDs — `comment_likes` has no FK to
   comments, so a cascade would orphan them
5. audited comments, then likes, then saves
6. the audited parent records

Each step asserts its expected affected-row count against the manifest; any mismatch, or a
partial cohort match, aborts and rolls the whole transaction back. Final assertions before
commit: zero legacy records, zero legacy interactions, zero polymorphic comment references,
zero legacy notification destinations, no review holding a legacy reference, and exactly the
expected review markers cleared. A clean or already-applied environment is a successful
no-op, never a failure.

**Gate 5 — remove the route and mappings last:** `/recommendations/:id`,

`RecommendationView`, `RecommendationContentViewer`, and the legacy mappings in
`notificationService` / `notificationDestination` (including the dead `/recommendation/`
rewrite), tests updated. Until then the route returns the existing controlled "content not
available" state, never a crash. Also now drop `recommendations.image_url` from both
orphan-media reference sets so the deleted records' images become collectable.

**Gate 6 — preservation and zero-dependency verification.** Prove unchanged:
`posts.post_type = 'recommendation'` rendering plus its comments and likes; notifications
about recommendation-type posts still resolve through normal post destination handling while
only legacy-record notifications were removed; `reviews.is_recommended`; the v4
"N recommending (M from circle)" header; the "Recommended by Your Circle" card;
who-to-follow `UserRecommendationCard`; `fallbackRecommendationService` and
`networkRecommendationService`; `ChatRecommendationCards`; `JourneyRecommendationCard`.
Then dependency sweep, tests, typecheck, build, evidence document, roadmap ticked.

Stop before Phase 4.4.

## Explicitly kept

The v4 entity page and its counts; all circle routines and the Circle card; every suggestion
engine and shared helper whose name merely contains "recommendation"; and the tables,
`recommendation_category`, the two review columns, remaining policies and indexes — physical
drops stay in Phase 4.5 after the 4.4 proof.

## Visible changes to expect

The Recs tab disappears from profiles, old recommendation entries stop appearing in the feed,
in search and on entity pages, and the notifications about them are removed. Reviews,
ratings, recommending counts, circle counts, posts and recommendation-type posts are
unaffected.

## Technical notes

Implementation rules for the freeze: address every routine by its full identity signature
(both `get_comments_with_profiles` overloads included); preserve owner, volatility, return
type, parameter defaults, grants and post behaviour, changing only the legacy branch; keep
rewritten SECURITY DEFINER routines on a pinned `search_path`. After the transaction, re-verify
that no application role has any path that can fire a legacy trigger. The secured manifest is
retained (uncommitted) through the Phase 4.5 close-out for rollback investigation. Generated
Supabase types are regenerated only if a signature actually changes — no churn otherwise.

One replayable migration (the freeze: grants, policies, routine bodies and EXECUTE) plus one

audited transactional production cleanup driven by the secured manifest. No table, enum or
column is dropped; review marker columns are cleared so 4.4 can prove zero dependency before
4.5 removes them.
