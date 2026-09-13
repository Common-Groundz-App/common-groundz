# Phase 4.2B.4A — proof gate (evidence only; nothing dropped, nothing changed)

Date: 2026-09-13. No `DROP`, no threshold edit, no filter change, no scheduler change, no regeneration
of generated types. Two findings below need a decision before 4.2B.4B.

## Method (reproducible)

| Surface | How it was checked |
|---|---|
| Application source, Edge Functions, tests/setup, `scripts/`, root commands, SQL outside `supabase/migrations/`, Supabase config | repository-wide `rg` over the whole tree with `node_modules`, `.git`, `supabase/migrations/`, `.lovable/`, `docs/`, `dist/` excluded |
| CI/CD | `ls .github/workflows/` + full-text search of the workflow file |
| Routine bodies | `pg_get_functiondef` regex over every `public` routine |
| Views, triggers, policies, indexes, constraints, defaults | `pg_class` / `pg_depend` per artefact (`refobjid`/`refobjsubid`, including per-column dependencies) |
| Scheduled jobs | `select jobname, schedule, command from cron.job` |
| Live data volumes | direct counts |

Non-blocking by definition, recorded but not disqualifying: historical migration files, verification
documents, archived plans, comments, and `src/integrations/supabase/types.ts` before regeneration.

## 1. Artefact / dependency table

Each function overload is its own artefact. "Blocking" = live source, CI, Edge Function, DB object,
catalogue dependency, scheduler, or required display data.

| Artefact | Blocking source / CI | Blocking DB references | Scheduler | Rows / data | Retirement candidate |
|---|---|---|---|---|---|
| `calculate_trending_score(uuid)` | none (only generated types + roadmap text) | **none** — no routine, view, trigger or policy references it | none | n/a | yes |
| `calculate_enhanced_trending_score(uuid)` | none | referenced by `update_all_trending_scores()` (itself retiring) | none | n/a | yes, with its caller |
| `update_all_trending_scores()` | none | none | none | n/a | yes |
| `calculate_user_similarity(uuid,uuid)` | none | none | none | n/a | yes |
| `get_who_to_follow(uuid,int)` | none | none | none | n/a | yes |
| `get_personalized_entities(uuid,int)` | none | none | none | n/a | yes |
| `calculate_user_reputation(uuid)` | none | none | none | n/a | yes |
| `calculate_social_influence_score(uuid,text)` | none | none | none | n/a | yes |
| `social_influence_scores` (v1 table) | none | only its own defaults, constraints and policies | none | **0 rows** (v2 holds 21) | yes |
| `entities.trending_score` (v1 column) | none | own default + `idx_entities_trending_score`, `idx_entities_trending_popularity` (drop with the column) | none | 86 non-zero | **blocked — see finding A** |
| `entity_stats_view` (v1 materialized view) | none | no routine, no view, no dependent object | `refresh-entity-stats-view-hourly` (retires with it) | 329 rows (same as v2) | yes |
| `recommendation_quality_scores` | read by `enhancedDiscoveryService.getQualityNewThisWeek`; written by `calculateQualityScores`, which has **no caller** | only own defaults/constraints | none | 22 stale rows | yes, reader dependence and writer together |
| `has_network_recommendations(p_user_id,p_entity_id,p_min_count)` | only its own unused wrapper `hasNetworkRecommendations` (no caller) | the other overload matches by name only | none | n/a | yes |
| `has_network_recommendations(p_entity_id,p_current_user_id,p_min_following,p_min_recommendations)` | none | name-match only | none | n/a | yes |
| `get_network_entity_recommendations(uuid,uuid,int)` | only its own unused wrapper `getNetworkEntityRecommendations` (no caller) | none | n/a | yes |

Confirmed untouched and live: `get_aggregated_network_recommendations_discovery` (viewer-checked,
canonical, endorsement-gated) is what the v4 entity page actually uses, via
`getNetworkEntityRecommendationsWithCache`.

## 2. Trending-hashtags reachability — resolved, no dependency

Both `calculate_trending_hashtags` overloads were read in full. Neither calls
`calculate_trending_score`, and neither reads `entities.trending_score`. The
`trending_score` in the two-argument overload is its **own computed output column**, derived from post
counts and recency. The earlier roadmap note was a name-match false positive.

**Recommendation:** no migration, no retirement. The hashtags routines stay exactly as they are and
place no hold on retiring the v1 trending scorer.

## 3. Impact of the 3.5 average-rating filter (measured, unchanged)

`applyQualityFiltering` in `networkRecommendationService` drops already-endorsed Circle results whose
Circle average (computed over **all** canonical rows, including people who answered "no") is below 3.5.

Measured over the whole live follow graph, mirroring the live routine's population:

- 81 endorsed viewer/entity pairs across 8 viewers.
- **0 removed** by the 3.5 filter.
- Lowest Circle average among endorsed pairs: exactly **3.5** (at the boundary); highest 5.0.
- No viewer loses the surface either way.

**Recommendation: remove it in 4.2B.4B.** It is a legacy rating-as-quality proxy sitting after an
explicit endorsement gate, and it currently changes nothing — so removing it is free today, whereas
keeping it means one "no"-heavy Circle can silently hide a genuinely endorsed item later. Keeping it is
defensible if you want an explicit quality bar; it is your call, not a cleanup decision.

## 4. Semantic threshold audit

| Location | Threshold | Meaning | Proposed action |
|---|---|---|---|
| `networkRecommendationService.applyQualityFiltering` | `average_rating < 3.5` | rating-as-quality bar after endorsement | remove (see §3) |
| `has_network_recommendations` ×2, `get_network_entity_recommendations` | `rating >= 3` / `>= 4` | rating standing in for "recommended" | removed with the dead routines |
| `discoveryService.getNewThisWeek` | `count >= 2 || avg >= 4.0` | "worth surfacing" proxy on a *new-items* list | remove the rating clause; keep the reviewer-count clause as an explicit evidence bar |
| `enhancedDiscoveryService` spam heuristics (`rating >= 4` with `view_count < 5`, ratio `> 0.6`) | spam detection over legacy rows | retires with the quality scorer |
| `enhancedDiscoveryService.enhanceNewReason` (`qualityScore > 0.6`) | copy selection from the stale quality table | retires with the quality scorer |
| `get_fallback_entity_recommendations` (`avg_rating >= 4.5`) | reason-label selection only, never an eligibility gate | keep, documented as intentional |
| `fallbackRecommendationService` (`average_rating >= 4.5`, `recommendation_count >= 20`) | genuine rating/volume bucketing and ranking bonus | keep, documented as intentional |
| `fallbackRecommendationService` (`isTrendingV2`) | labelled-bucket membership | keep; approved classification rule |
| `useTrustMetrics` (`effectiveRating >= 4`) | "Circle certified" percentage — a real rating statistic | keep, documented as intentional |
| `ratingColorUtils`, `RatingDistribution` | rating-band display labels | keep; presentation only |
| `enhancedExploreService` (`interest_score > 5`, `view_velocity > 5`) | reason-label selection only | keep, documented as intentional |
| `extract-product-relationships`, `reviewDataUtils` | rating-derived relationship/sample copy | out of scope, unrelated to v1 scoring |

No occurrence is proposed for removal on the basis of the number alone.

## 5. Findings that need a decision before 4.2B.4B

### Finding A — nothing schedules the trending v2 orchestrator (blocking)

`.github/workflows/daily-refresh.yml` is the only workflow and it calls
`daily-refresh-entity-images`, **not** `update-trending-scores`. No cron job calls it either (the five
jobs are: orphan-media dry run, retracted-notification prune, both stats refreshes, influence refresh).
Consequence, measured: **every** `entities.trending_score_v2` value is 0 (max 0, mean 0 across 329
live items), while the v1 column still has 86 non-zero values.

So trending ordering is currently a no-op and the labelled trending bucket is always empty. This does
not break any surface — ordering falls through to the tie-breaks and other buckets fill in — but the v1
trending column must not be dropped while v2 has never actually been produced.

**Recommendation:** before 4.2B.4B, schedule `update-trending-scores` the same way the influence
refresh is scheduled (cron → protected Edge Function → Vault-held secret), then confirm non-zero v2
values, and only then treat the v1 column as retirable. My 4.2B.3 record claimed this scheduler existed;
that claim was wrong and is corrected here.

### Finding B — the 3.5 filter decision in §3 (product call, zero impact today)

## 6. Proposed retirement list and migration order for 4.2B.4B

Pending your approval of A and B, in this order, no `CASCADE` anywhere, each stopping on any
unexpected dependency:

1. Delete the two unused service wrappers, then drop `get_network_entity_recommendations` and both
   `has_network_recommendations` overloads.
2. Remove `getQualityNewThisWeek`'s dependence on the stale table and delete `calculateQualityScores`
   / `calculateEntityQuality`, then drop `recommendation_quality_scores`.
3. Drop `update_all_trending_scores()`, then `calculate_enhanced_trending_score(uuid)`, then
   `calculate_trending_score(uuid)`.
4. Drop `calculate_user_similarity`, `get_who_to_follow`, `get_personalized_entities`,
   `calculate_user_reputation`, `calculate_social_influence_score`.
5. Drop `social_influence_scores`.
6. Unschedule `refresh-entity-stats-view-hourly`, then drop `entity_stats_view` and its two indexes.
7. **Only after Finding A is fixed and verified:** drop `idx_entities_trending_score`,
   `idx_entities_trending_popularity`, then `entities.trending_score`.
8. Apply the approved threshold changes from §4, regenerate generated types once, re-run the sweep,
   exercise every switched surface, re-measure schedulers, run tests, typecheck and build.

## 7. Still deferred

Legacy recommendation listing and display (profile service, entity page legacy section, feed hook,
notification targets, content viewer, `/recommendations/:id`) and clearing `reviews.recommendation_id`
/ `reviews.is_converted` → 4.3. Recommendation tables and the `recommendation_category` enum → 4.5.
Consensus calibration of influence → separate experiment. Legacy row count today: 9.
