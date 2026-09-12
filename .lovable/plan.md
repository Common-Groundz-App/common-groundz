# Phase 4.2B.1 close-out, then 4.2B.2 rebuilt as an additive rollout

Both reviews are right, and the live database backs them up. The maths is approved; the deployment
plan was the problem. This revision replaces in-place replacement with **additive v2 routines that
run alongside v1**, so no consumer ever sees a value whose meaning changed under it.

## What the audit found (evidence, not assumption)

4.2B.1 is complete: contract v2 (330 lines) and fixtures (`contractVersion: 2`, 48 scenarios across
trending 15, influence 9, personalised 7, similarity 7, reputation 4, who-to-follow 3, cross-cutting
3) are committed and consistent. Only bookkeeping remains: `roadmap.md` still shows 4.2B.1 unchecked.

The cutover objections are confirmed:

- **Trending scale really would break readers.** `entities.trending_score` today maxes at 0.48 across
  86 non-zero rows, and live readers use absolute thresholds against the *old* scale:
  `discoveryService.ts` filters `.gte('trending_score', 5)`, `fallbackRecommendationService.ts` uses
  `> 0.5` and `> 0.6`, `searchRanking.ts` and `advancedPersonalizationService.ts` read it raw. "Every
  reader clamps" was not true.
- **The orchestrator was missing from the plan.** `update_all_trending_scores()` selects candidates
  by joining the legacy records table, calls the enhanced routine, and has two live callers:
  `supabase/functions/update-trending-scores` and `enhancedExploreService.updateAllTrendingScores`.
- **Similarity has a NULL-destroying caller today**: `calculate-lifestyle-similarity` does
  `similarityResult || 0`.
- **Influence is easier than feared**: `social_influence_scores` currently holds **0 rows**, so there
  is no legacy cache to delete — but `socialIntelligenceService` still reads and writes it on the
  legacy category domain, so its switch is still a caller-paired change.
- **Dropping the plain routine is nearly safe**: no app or Edge Function calls
  `calculate_trending_score`; no trigger and no cron job references it; exactly one database function
  (`calculate_trending_hashtags`) mentions it and must be inspected before anything is dropped.

## 4.2B.2 — build v2 next to v1, change nothing live

Each score family is its own migration, independently verifiable, with no consumer impact:

| Family | Added in 4.2B.2 | v1 during this phase |
|---|---|---|
| Trending | `calculate_entity_trending_score_v2(entity)` (pure, returns the score, **writes nothing**) plus `select_trending_candidates_v2()` and `update_all_trending_scores_v2()` writing to a **new** `entities.trending_score_v2` column | untouched: `trending_score` keeps its old scale and old writer |
| Influence | `calculate_social_influence_score_v2(user, canonical_type)` writing to a new `social_influence_scores_v2` table on the canonical 15 types | legacy routine and empty table left in place |
| Similarity | `calculate_user_similarity_v2(a, b)` with NULL for insufficient evidence | legacy routine untouched, so `|| 0` cannot corrupt anything |
| Personalised items | `get_personalized_entities_v2(user, limit)`, reading `trending_score_v2` | legacy routine untouched |
| Reputation | `calculate_user_reputation_v2(user)` — returns the score, **does not write** `user_reputation` | legacy writer untouched |
| Who-to-follow | `get_who_to_follow_v2(user, limit)`, same output columns | legacy routine untouched |

Rules for every v2 routine: legacy records table never read; `reviews` eligibility via
`status`/`visibility` (there is no `reviews.is_deleted`); posts/entities via `is_deleted = false`;
post↔entity linkage via `post_entities UNION posts.entity_id`; boosts contribute 0;
`-- scoring contract v2` comment in each body. Nothing is dropped, deleted or recomputed in place.

**Security contract, frozen per routine** (not left to implementation):

| Routine | Identity | Access |
|---|---|---|
| `get_personalized_entities_v2`, `get_who_to_follow_v2` | `SECURITY DEFINER`, but the body **rejects any call where the requested user is not `auth.uid()`** unless the caller is `service_role` | `authenticated`, `service_role` |
| `calculate_user_similarity_v2` | `SECURITY DEFINER`, public inputs only (public published canonical reviews) | `authenticated`, `service_role` |
| `calculate_user_reputation_v2`, `calculate_entity_trending_score_v2` | `SECURITY DEFINER`, pure — return a value, write nothing | `authenticated`, `service_role` |
| `select_trending_candidates_v2`, `update_all_trending_scores_v2`, `calculate_social_influence_score_v2` | `SECURITY DEFINER`, write derived data | **`service_role` only** — not callable by ordinary users |

`social_influence_scores_v2` gets GRANTs plus RLS in the same migration that creates it: read for
`authenticated`, writes `service_role` only. Every routine sets an explicit `search_path`.

## Verification before 4.2B.2 is called done

- Run every fixture group as SQL against transaction-scoped fixture rows, rolled back — no
  production row created, updated or deleted — and record actual vs expected intermediates.
- **Bootstrap once for every non-deleted entity**, not just the candidate set, so no row is left NULL
  merely for lack of recent activity. `select_trending_candidates_v2()` is for ongoing incremental
  refresh only. Then show both scales side by side and confirm every v2 value is inside [0, 1.2].
- Authorization tests: a signed-in user cannot get another user's personalised or who-to-follow rows,
  and the writer routines refuse non-`service_role` callers.
- Prove no v2 routine reads the legacy records table.
- Regenerate the Supabase types file so the new column, table and routines are typed.
- Full test suite, typecheck, production build; write
  `docs/verification/phase-4-2b2-scoring-routines.md`; mark 4.2B.1 and 4.2B.2 in `roadmap.md`.

Hard stop for review after that. No consumer changes and no old-threshold edits in this phase.

## 4.2B.3 — switch consumers, one complete pipeline at a time

Each pipeline moves atomically, routine plus every caller in the same step:

1. **Trending**: `discoveryService`, `fallbackRecommendationService`, `searchRanking`,
   `advancedPersonalizationService`, `enhancedExploreService`, `update-trending-scores` Edge Function
   — thresholds rescaled to the [0, 1.2] range, all ordering moved to `trending_score_v2`. In the same
   step the scheduled Edge Function becomes the only v2 updater and the browser `setInterval` loop in
   `src/services/backgroundService.ts` is removed, so there is never more than one live v2 scheduler.
2. **Similarity**: `collaborativeFilteringService` and `calculate-lifestyle-similarity` switched to
   the v2 routine with `|| 0` and `?? 0` removed; NULL means "no evidence" end to end.
3. **Influence**: `socialIntelligenceService` switched to canonical types and the v2 table together.
4. **Personalised / who-to-follow / reputation**: their callers switched to the v2 routines.

## 4.2B.4 — prove zero dependency, and only then retire v1

Retirement is a separate gate, not a consequence of switching callers. 4.2B.4 must first prove:

- zero live v1 callers in app code, Edge Functions, database routines, triggers and cron jobs —
  including understanding the `calculate_trending_hashtags` reference to `calculate_trending_score`;
- no scoring path reads the legacy records table;
- v2 fixture results correct, scheduler behaving, tests/typecheck/build green;
- no active consumer still assumes v1-scale `trending_score` (this is the stronger scale check, and it
  belongs here — during coexistence `>= 5` on the old column is correct, not a bug).

Only after that: drop the v1 routines, retire or rename the old column, and retire
`social_influence_scores`. Physical drops may also be deferred into the existing 4.5 cleanup.

## Two additions of my own

- **The scale guard lives on the versioned column**, so it cannot flag the compatibility we are
  deliberately preserving: a database `CHECK (trending_score_v2 BETWEEN 0 AND 1.2)` plus a test that
  v2 *consumers* assume the v2 range. The old-threshold sweep is a 4.2B.4 check, as above.
- **`backgroundService` runs the trending updater on a browser `setInterval` in production**, which
  conflicts with the project's timer policy and makes every open tab a scheduler. It is explicitly
  assigned to 4.2B.3 (paired with enabling the scheduled updater), not touched in 4.2B.2.


## Technical notes

Separate migrations per family, in this order: trending v2 (column + check constraint + pure scorer +
candidate selector + orchestrator), influence v2 (table with GRANTs and RLS + routine), similarity
v2, reputation v2, who-to-follow v2, personalised v2. All are additive: no `DROP`, no `DELETE`, no
in-place recompute of a column an existing consumer reads. `roadmap.md` gains the new 4.2B.2 /
4.2B.3 / 4.2B.4 breakdown and the `backgroundService` follow-up as its own task.
