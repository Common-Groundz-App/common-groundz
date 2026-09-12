# Phase 4.2B.2 — Additive v2 scoring build: verification record

Status: **complete** (additive only; no v1 routine, caller, threshold, or browser scheduling changed).

## What was built

| Family | Objects | Access |
|---|---|---|
| Trending v2 | `entities.trending_score_v2` (NOT NULL DEFAULT 0, CHECK 0..1.2); `calculate_entity_trending_score_v2` (pure), `select_trending_candidates_v2`, `update_all_trending_scores_v2` | calculator: authenticated + service_role; selector/updater: service_role only |
| Influence v2 | `social_influence_scores_v2` (UNIQUE (user_id, canonical_type), RLS, SELECT to authenticated); `calculate_social_influence_components_v2`, `calculate_social_influence_score_v2`, `refresh_social_influence_scores_v2` | table: SELECT authenticated, ALL service_role; routines: service_role only |
| Similarity v2 | `calculate_user_similarity_v2(uuid, uuid)` | anon/authenticated/service_role (mirrors v1 proven surface) |
| Reputation v2 | `calculate_user_reputation_v2(uuid)` | service_role only |
| Who-to-follow v2 | `get_who_to_follow_v2(user, limit)` | viewer-gated; authenticated + service_role |
| Personalised v2 | `get_personalized_entities_v2(user, limit)` | viewer-gated; authenticated + service_role |
| Endpoint | Edge Function `refresh-social-influence-v2`, deployed unscheduled | admin JWT + has_role, or `INFLUENCE_REFRESH_CRON_SECRET` header |

Every new routine: `OWNER postgres`, `REVOKE ALL FROM PUBLIC/anon/authenticated`, then targeted
EXECUTE grants. Viewer-scoped routines enforce
`auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id → raise`.
Limits clamped to 1–50. Influence cache lifecycle is a reconciling upsert+delete of stale v2 rows
only (contract v2: stale-row deletion in the new cache is permitted).

## Contract clarifications recorded during build

- **Reputation eligible contributions**: reviews require `entity_id IS NOT NULL` and public
  visibility; posts require public visibility; entities require `created_by = user` and not deleted.
- **Personalised "already reviewed"**: means ANY existing review record by the viewer for the item,
  drafts included (not only `status = 'published'`).
- **Influence `engagement_avg`**: stores the raw average likes; the saturation at 50 applies only
  inside the score formula.

## Bootstrap evidence

- Trending backfill: `update_all_trending_scores_v2(true)` scored all 329 live entities; post-run
  check `min = max = 0` — correct: velocity uses a 24 h window and base popularity/geo/seasonal are
  frozen at zero, so a no-recent-activity dataset scores 0.
- Influence bootstrap: `refresh_social_influence_scores_v2()` wrote 21 rows across 7 canonical
  types; 0 out-of-range scores; 0 duplicate (user, type) pairs.

## Deliberately deferred to 4.2B.3

- Any consumer/cutover change: readers still use v1 columns and routines everywhere.
- Cron scheduling of `refresh-social-influence-v2` and browser `setInterval` removal.

## Deliberately deferred to 4.2B.4

- Dependency proof gate and v1 retirement.
