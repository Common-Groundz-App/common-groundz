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

## 8. Activation evidence and final retirement list (2026-09-14, Phase 4.2B.4A-bis)

### 8.1 Scheduler inventory after activation — exactly one producer per job

| Job | Schedule (UTC) | Execution path |
| --- | --- | --- |
| `refresh-entity-stats-view-hourly` | `0 * * * *` | cron → `REFRESH MATERIALIZED VIEW entity_stats_view` |
| `refresh-entity-stats-v2-hourly` | `5 * * * *` | cron → `REFRESH MATERIALIZED VIEW entity_stats_v2` |
| `cleanup-orphan-media-weekly-dryrun` | `0 3 * * 0` | cron → SQL (dry run) |
| `prune-retracted-notifications` | `17 3 * * *` | cron → SQL |
| `refresh-social-influence-v2-daily` | `12 4 * * *` | cron → `net.http_post` → protected `refresh-social-influence-v2` → `refresh_social_influence_scores_v2()` |
| `refresh-trending-scores-v2-hourly` | `20 * * * *` | cron → `net.http_post` → protected `update-trending-scores` → `update_all_trending_scores_v2(false)` |

- GitHub workflows: one only (`daily-refresh-entity-images`, `0 0 * * *`) — image refresh, unrelated to scoring.
- Browser code: no scheduler, no writer of any score column.
- Trending runs 15 minutes after the statistics refresh; influence remains daily at 04:12.
- All three derived-score refreshers now live in the same operational system (Supabase cron → protected Edge Function → v2 routine), with the materialized views refreshed directly by cron.

### 8.2 Guard on the trending function — frozen B2 security model preserved

- `verify_jwt = false` for `update-trending-scores` (`supabase/config.toml`) so the request reaches the function's own guard rather than a platform response.
- Accepted identities: `x-cron-secret` validated by `public.is_valid_trending_cron_secret(text)`; admin bearer JWT verified against `public.user_roles`; `TRENDING_REFRESH_CRON_SECRET` environment secret as a manual-trigger fallback. Everything else receives `401`.
- `is_valid_trending_cron_secret`: `SECURITY DEFINER`, owner `postgres`, `search_path = ''`, `EXECUTE` granted to `postgres` and `service_role` only (confirmed via `aclexplode(proacl)`); null/empty short-circuits; no failure reason is ever returned.
- The scheduler password is stored in Vault (`trending_refresh_cron_secret`) and read by the cron command at send time. No secret literal exists in the repository — searching both names returns references only (function source + migration files).
- Bootstrap mode is unreachable from cron: the function always calls `update_all_trending_scores_v2(false)`. Bootstrap stays an administrative, explicitly invoked operation.

### 8.3 Rejection matrix against the deployed function

| Request | Result |
| --- | --- |
| `POST` anonymous | `401 {"error":"unauthorized","code":"UNAUTHORIZED"}` |
| `POST` wrong secret | `401 {"error":"unauthorized","code":"UNAUTHORIZED"}` |
| `POST` empty secret | `401 {"error":"unauthorized","code":"UNAUTHORIZED"}` |
| `GET` | `405 {"error":"method_not_allowed"}` |
| `POST` with the Vault-backed secret | `200 {"ok":true,"updatedCount":2,…}` |

### 8.4 Execution proof

Two authorised invocations fired from a temporary once-a-minute verification job carrying the
identical Vault-backed command; the job was unscheduled immediately afterwards and the run history
shows both `succeeded` / `1 row`.

- `02:58:00` → `200 {"ok":true,"updatedCount":2,"timestamp":"2026-09-14T02:58:03.671Z"}`
- `02:59:00` → `200 {"ok":true,"updatedCount":2,"timestamp":"2026-09-14T02:59:01.041Z"}`

Both runs selected and rewrote the same two candidates and reported the same count, so the refresh
is idempotent and self-selecting. Scores remained inside the frozen bound: across 329 non-deleted
entities `min = 0`, `max = 0.0008`, and `0` rows outside `[0, 1.2]`. No synthetic activity rows were
inserted into production at any point — the producer was observed working on real data only.

### 8.5 Circle eligibility filter removed (Decision 2)

`applyQualityFiltering` in `src/services/networkRecommendationService.ts` no longer rejects
`average_rating < 3.5`. Endorsement — the canonical review's stored `is_recommended` resolution — is
the sole eligibility rule; average rating stays available for display and ordering. The filter
removed 0 of 81 endorsed viewer/entity pairs today, so nothing changes immediately; the removal
deliberately allows a future explicitly endorsed entity with a low average rating to stay eligible.
Both network-recommendation call sites share this function, so both are covered.

### 8.6 Final B4B retirement list and migration order

Precondition for step 7 (a proven live v2 Trending producer) is now satisfied; the order below is
unchanged from §6. No `CASCADE` anywhere; any unexpected dependency stops that item.

1. Delete the unused wrappers `hasNetworkRecommendations` / `getNetworkEntityRecommendations` in
   `src/services/networkRecommendationService.ts` (verified no callers outside their own definitions),
   then drop `public.has_network_recommendations(uuid)` and both
   `public.get_network_entity_recommendations` overloads.
2. Rewrite `enhancedDiscoveryService.getQualityNewThisWeek` (live caller: `src/hooks/use-discovery.ts`)
   so it no longer reads `recommendation_quality_scores`, delete the dead `calculateQualityScores` /
   `calculateEntityQuality`, then drop `public.recommendation_quality_scores` (22 stale rows).
3. Drop `public.update_all_trending_scores()`, then `public.calculate_enhanced_trending_score(uuid)`,
   then `public.calculate_trending_score(uuid)` (`calculate_trending_hashtags` no longer depends on them).
4. Drop `public.calculate_user_similarity`, `public.get_who_to_follow`, `public.get_personalized_entities`,
   `public.calculate_user_reputation`, `public.calculate_social_influence_score`.
5. Drop `public.social_influence_scores` (0 rows; v2 holds 21).
6. `cron.unschedule('refresh-entity-stats-view-hourly')`, then drop `entity_stats_view` and its two indexes.
7. Drop `idx_entities_trending_score`, `idx_entities_trending_popularity`, then `entities.trending_score`
   (84 entities still carry legacy values; v2 is now produced hourly).
8. Apply the remaining approved threshold changes from §4, regenerate generated types **once**, re-run
   the repository-wide sweep, exercise every switched surface, re-measure schedulers, run tests, typecheck, build.

### 8.7 Verification

Tests `633/633` pass; typecheck clean; production build green; Supabase linter output unchanged at
475 issues / 8 distinct types (all pre-existing, none introduced by this stage).

## 9. Phase 4.2B.4B — executed retirement (2026-09-15)

### 9.1 Signature correction (from live `pg_proc`, not generated types)

The §8 drop list named `has_network_recommendations(uuid)` and "both
`get_network_entity_recommendations` overloads". That was wrong. Live identity signatures:

| Signature | Action | Evidence |
|---|---|---|
| `public.has_network_recommendations(uuid, uuid, integer)` | dropped | no caller |
| `public.has_network_recommendations(uuid, uuid, integer, integer)` | dropped | no caller |
| `public.get_network_entity_recommendations(uuid, uuid, integer)` | dropped (one overload, not two) | no caller |
| `public.get_aggregated_network_recommendations_discovery(uuid, uuid, integer)` | kept — live | Circle card |
| `public.get_aggregated_network_recommendations_discovery(uuid, uuid[], integer)` | kept — deferred to 4.3 | unused, needs its own sweep |
| `public.has_network_activity(uuid, integer)` | kept — live | gates the Circle card |
| `public.get_circle_recommendation_count(uuid, uuid)` | kept — live | entity header "N from circle" |
| `public.get_circle_recommendation_counts_batch(uuid[], uuid)` | kept — live | explore + discovery |

The entity-v4 header counts ("6 recommending (4 from circle)") never touched the retired wrappers.

### 9.2 Threshold changes actually applied

| File / routine | Current | Applied | Reason |
|---|---|---|---|
| `enhancedDiscoveryService.getQualityNewThisWeek` | read `recommendation_quality_scores`, scored by quality/spam/social-proof | reads nothing from it; recency order + upstream reviewer-evidence bar | table's writer was already dead; prerequisite for the drop |

Deferred, **not** applied: `discoveryService.getNewThisWeek` `count >= 2 OR average >= 4.0` → reviewer
count alone. Needs its own impact measurement and separate approval.

### 9.3 Migration order executed (no `CASCADE`, none stopped)

1. Deleted `hasNetworkRecommendations` / `getNetworkEntityRecommendations` wrappers, then dropped the
   three Circle routines above.
2. Rewrote `getQualityNewThisWeek`, deleted `calculateQualityScores`, `calculateEntityQuality`,
   `detectSpamPatterns`, `calculateRatingVariance`, `enhanceNewReasonWithQuality`, then dropped
   `public.recommendation_quality_scores`.
3. Dropped `update_all_trending_scores()`, `calculate_enhanced_trending_score(uuid)`,
   `calculate_trending_score(uuid)`.
4. Dropped `calculate_user_similarity(uuid,uuid)`, `get_who_to_follow(uuid,integer)`,
   `get_personalized_entities(uuid,integer)`, `calculate_user_reputation(uuid)`,
   `calculate_social_influence_score(uuid,text)`.
5. Dropped `public.social_influence_scores`.
6. Guarded `cron.unschedule('refresh-entity-stats-view-hourly')` (raising if absent), then
   `DROP MATERIALIZED VIEW public.entity_stats_view;` — post-check confirmed 0 leftover
   `idx_entity_stats_view%` objects, so both owned indexes went with the view.
7. Pre-check before the column drop: job `refresh-trending-scores-v2-hourly` had 3 successful runs in
   the preceding 3 hours (last 2026-09-15 06:20 UTC), so the v2 producer is live. Then dropped
   `idx_entities_trending_score`, `idx_entities_trending_popularity`, `entities.trending_score`.

### 9.4 Post-retirement verification

- Repository sweep: no live reference to any retired object. Remaining `trending_score` hits in
  `fallbackRecommendationService.ts` are the v2 RPC's own output field name, not the dropped column.
- Generated types refreshed once, after the final migration: zero occurrences of
  `recommendation_quality_scores`, `has_network_recommendations`,
  `get_network_entity_recommendations`, `entity_stats_view`, `social_influence_scores`.
- Schedulers: 5 cron jobs remain — entity-stats v2 hourly (minute 5), trending v2 hourly (minute 20),
  influence v2 daily 04:12, orphan-media weekly dry run, retracted-notification prune. Exactly one
  trending and one influence scheduler; no browser scheduler or writer; the only GitHub workflow
  refreshes entity images.
- Tests 633/633, typecheck clean, build OK, Supabase linter 448 issues / 8 types (down from 475
  purely through removals; nothing new).
