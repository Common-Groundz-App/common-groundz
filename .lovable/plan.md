# Phase 4.2B.4B — Corrected retirement list (verified signatures, explicit thresholds)

Both reviewers are right on all three points, and one of them (the signature mismatch) was a real error in my list. Corrected below from a live `pg_proc` query, not from the generated types file.

## First: the "6 recommending (4 from circle)" counts are safe

That header text does not use the two wrappers I proposed deleting. Verified:

- `6 recommending` and `(4 from circle)` on the v4 entity page come from the entity stats path, which calls `get_circle_recommendation_count` / `get_circle_recommendation_counts_batch`. Neither is on any drop list.
- The "Recommended by Your Circle" card uses `get_aggregated_network_recommendations_discovery` via `getNetworkEntityRecommendationsWithCache`. Also not on any drop list.
- The two wrappers `hasNetworkRecommendations` / `getNetworkEntityRecommendations` in the recommendation service have no callers anywhere outside their own file — the only other hits in the repo are the generated types file. Nothing rendered on the entity page reaches them.

So no visible logic is lost. The v4 page is untouched.

## Correction 1 — exact live signatures

Queried from the database. The earlier list was wrong in exactly the way codex said.

| Live signature | On drop list | Evidence |
|---|---|---|
| `public.has_network_recommendations(uuid, uuid, integer)` | yes | no callers; wrapper deleted first |
| `public.has_network_recommendations(uuid, uuid, integer, integer)` | yes | no callers anywhere |
| `public.get_network_entity_recommendations(uuid, uuid, integer)` | yes — one overload only, not two | wrapper deleted first |
| `public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer)` | **no — live** | called by the Circle card |
| `public.get_aggregated_network_recommendations_discovery(uuid, uuid[], integer)` | **no — deferred to 4.3** | appears unused, but proving that needs its own sweep; not part of this retirement |
| `public.has_network_activity(uuid, integer)` | **no — live** | gates the Circle card |
| `public.get_circle_recommendation_count(uuid, uuid)` | **no — live** | entity header count |
| `public.get_circle_recommendation_counts_batch(uuid[], uuid)` | **no — live** | explore + discovery |
| `public.update_all_trending_scores()` | yes | v1 orchestrator, unscheduled |
| `public.calculate_enhanced_trending_score(uuid)` | yes | v1 |
| `public.calculate_trending_score(uuid)` | yes | v1 |
| `public.calculate_user_similarity(uuid, uuid)` | yes | v2 in use |
| `public.get_who_to_follow(uuid, integer)` | yes | v2 in use |
| `public.get_personalized_entities(uuid, integer)` | yes | zero callers |
| `public.calculate_user_reputation(uuid)` | yes | v2 in use |
| `public.calculate_social_influence_score(uuid, text)` | yes | v2 in use |

Every drop uses the full identity signature, no bare name, no `CASCADE`.

## Correction 2 — explicit threshold changes

Only one threshold change remains in B4B, and it is a code deletion tied to the quality table:

| File / routine | Current | Replacement | Reason |
|---|---|---|---|
| `enhancedDiscoveryService.getQualityNewThisWeek` | reads `recommendation_quality_scores` for quality/spam/social-proof and scores from it | drop those reads; keep the list ordered by recency with the existing reviewer-count evidence bar | the table has been stale since its writer stopped running; it must go before the table can be dropped |

Explicitly **deferred, not part of B4B**:

| File / routine | Current | Proposed | Status |
|---|---|---|---|
| `discoveryService.getNewThisWeek` | `count >= 2 OR average >= 4.0` | `count >= 2` only | deferred — needs its own impact measurement and separate approval, as codex asked |

Already done and closed: the 3.5 Circle eligibility veto. Nothing else in B4B changes product logic.

## Correction 3 — deterministic v1 stats teardown

Order, as its own migration:

1. Unschedule `refresh-entity-stats-view-hourly`, verifying the job existed.
2. `DROP MATERIALIZED VIEW public.entity_stats_view;` (no `CASCADE`).
3. Query `pg_class` to confirm both owned indexes disappeared with it and no unexpected object remains.

No index is dropped by name first — Postgres owns them, and naming them separately is what risks operating on an already-removed object.

## Migration order

One migration per family, each stopping on any unexpected dependency:

1. Delete the two dead wrappers in the recommendation service, then drop the two `has_network_recommendations` overloads and the single `get_network_entity_recommendations` overload.
2. Rewrite `getQualityNewThisWeek`, delete the dead `calculateQualityScores` / `calculateEntityQuality`, then drop `public.recommendation_quality_scores`.
3. Drop the three v1 trending routines, orchestrator first.
4. Drop the five v1 similarity / who-to-follow / personalized / reputation / influence routines.
5. Drop `public.social_influence_scores` (0 rows; v2 holds 21).
6. V1 stats teardown per Correction 3.
7. Drop `idx_entities_trending_score`, `idx_entities_trending_popularity`, then `entities.trending_score`.
8. Regenerate generated types once, then re-run the dependency sweep, every switched surface, the scheduler count, tests, typecheck and build.

## One thing I would add

Before step 7, re-confirm the hourly trending job has produced at least one fresh run since activation, so we are not dropping the v1 column during a window where v2 has silently stopped. If that check fails, step 7 stops and the rest still proceeds.

Verification record appended to `docs/verification/phase-4-2b4a-proof-gate.md`; roadmap updated. Stop before Phase 4.3.
