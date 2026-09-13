# 4.2B.2 audit result, then 4.2B.3 consumer cutover

## Audit: 4.2B.2 is complete, no leftovers

Checked live, not assumed:

- All six score families exist with the frozen access rules: trending scorer (signed-in + internal),
  candidate selector and updater (internal only), influence components/score/refresh (internal only),
  similarity (visitor/signed-in/internal, mirroring the old one), reputation (internal only),
  who-to-follow and personalised items (signed-in + internal, viewer-gated). Every one is owned
  correctly with a fixed search path.
- New trending value present on items (329 live items, all 0 — correct, since velocity uses a 24-hour
  window and there is no activity in it); old value still populated on 86 items and untouched.
- New influence store holds the bootstrap: 21 rows across 7 canonical types.
- Refresh endpoint deployed with both entry checks (internal secret or signed-in admin) and
  deliberately **not scheduled** — no cron job references it.
- No app screen reads any new value yet, and no database routine calls the new ones. Correct for B2.

Bookkeeping is also done: roadmap marks 4.2B.2 complete and the evidence document exists.

**One finding worth flagging before cutover:** the influence code path also reads the legacy
standalone recommendation records, which are retired in Phase 4.3. Its switch below covers the score
source only; the legacy record reads stay until 4.3.

## 4.2B.3 — switch each pipeline over, one at a time

Each pipeline moves as one complete step (score source plus every reader in the same change), and is
verified before the next begins.

### 1. Trending

- Every listing that sorts by the old trending value switches to the new one: discovery lists,
  fallback suggestions, explore, search ranking input, personalisation ordering.
- All absolute thresholds are rescaled from the old open-ended scale to the new 0–1.2 scale:
  the `>= 5` discovery cut, and the `> 0.5` / `> 0.6` fallback cuts. New cut points are stated in the
  cutover document, not guessed inline.
- The background refresh becomes single-source: schedule the internal trending updater on the server
  and **remove the browser 30-minute timer** in `backgroundService.ts` (and its production auto-start),
  so open tabs stop acting as schedulers. Manual admin refresh keeps working through the server path.
- The old value and old updater are left in place (retirement is 4.2B.4).

### 2. Similarity

- Both callers (collaborative filtering, lifestyle-similarity endpoint) switch to the new routine and
  the `|| 0` / `?? 0` fallbacks are removed, so "not comparable" stays distinct from "no similarity"
  end to end. Every consumer of the value must handle the absent case explicitly.

### 3. Influence

- The influence code path switches to the new store and canonical item types, and becomes
  **read-only**: the browser no longer computes or writes scores (it cannot write an internal table).
  Its 0.3 minimum threshold is re-expressed against the new 0–1 score.
- Schedule the refresh endpoint so the new store stays current, then confirm one run produces the
  expected reconciled rows.

### 4. Who-to-follow, reputation, personalised items

- Who-to-follow suggestions switch to the new routine (same output shape, so the UI is unchanged).
- Reputation and personalised items have **no live caller today** (verified in app code and in
  database routines), so there is nothing to switch; this is recorded as a verified no-op rather than
  silently skipped.

## Verification before 4.2B.3 is marked done

- After each pipeline: confirm the switched screens still return results, and that rescaled cut points
  don't empty a list (with all-zero trending values today, a strict `> 0` cut would blank discovery —
  so the fallback ordering behaviour is checked explicitly).
- Prove exactly one trending scheduler is live and the browser timer is gone.
- Prove the influence store is refreshed by the scheduled job and that no browser code writes it.
- Prove no similarity consumer collapses "not comparable" into zero.
- Full test suite, typecheck, production build; write `docs/verification/phase-4-2b3-consumer-cutover.md`
  with the chosen thresholds and per-pipeline evidence; tick 4.2B.3 in the roadmap.
- No v1 routine, column or table is dropped in this phase — that stays 4.2B.4.

## Technical notes

- Files: `discoveryService.ts`, `fallbackRecommendationService.ts`, `enhancedExploreService.ts`,
  `advancedPersonalizationService.ts`, `searchRanking.ts`, `collaborativeFilteringService.ts`,
  `socialIntelligenceService.ts`, `userRecommendationService.ts`, `backgroundService.ts`,
  Edge Functions `update-trending-scores` and `calculate-lifestyle-similarity`.
- Two cron jobs are added through a direct SQL insert (not a migration), because both carry
  project-specific URLs and the internal secret: the trending updater and the influence refresh
  endpoint with its `x-cron-secret` header.
- `update-trending-scores` switches to the v2 orchestrator (incremental candidates, not bootstrap).
- Ordering keys change from `trending_score` to `trending_score_v2`; the new column is
  `NOT NULL DEFAULT 0`, so no null handling is needed on the sort.
