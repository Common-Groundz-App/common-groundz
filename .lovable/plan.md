# 4.2B.4A-bis — activate the trending producer, then bring back the final drop list

Agreed on both decisions: trending scheduling moves into Supabase cron alongside influence and
entity stats, and the 3.5 average-rating filter comes out. Nothing is dropped in this stage.

## Reconciliation (already verified, read-only)

- The only GitHub workflow is `daily-refresh-entity-images` (daily at midnight UTC). It has never
  called the trending updater. The 4.2B.3 close-out record claiming a "daily GitHub workflow →
  update-trending-scores" was wrong; it will be annotated with a correction.
- Scheduled jobs today: entity-stats view (hourly, minute 0), entity-stats v2 (hourly, minute 5),
  orphan-media weekly dry run, retracted-notification prune, influence daily (04:12). No trending job.
- No browser code schedules or writes trending; the only remaining mention is an explanatory comment.

So the trending producer has genuinely never run — which is why every v2 score is 0.

## Stage 1 — one protected trending scheduler in Supabase cron

1. Protect the `update-trending-scores` function's HTTP boundary with the same pattern influence
   uses: accept either an `x-cron-secret` validated against a Vault entry through a service-role-only
   SQL validator, or an admin bearer token. Reject everything else with 401. Declare
   `verify_jwt = false` for it in `supabase/config.toml`.
2. Create the Vault entry for the trending cron secret if absent (random value, never printed,
   never committed) plus its service-role-only validator routine.
3. Schedule one idempotent job `refresh-trending-scores-v2-hourly` at minute 20 of every hour
   (offset from the two stats jobs), calling the function through `net.http_post` with the Vault
   value as the header. Guarded unschedule of any pre-existing trending job name first.
   Scheduled runs always call the updater in incremental mode; bootstrap stays admin-only.
4. Keep the GitHub image-refresh workflow untouched — it is not a trending scheduler.

## Stage 2 — prove the producer actually works (execution proof only, no production fixtures)

- Show exactly one trending scheduler exists across Supabase cron, GitHub workflows and app code.
- Trigger one run and prove: HTTP 200, updater executed, returned candidate/updated counts, run
  timestamps in the job history, and every resulting score inside the frozen [0, 1.2] bound.
- A successful run that legitimately produces all zeros is acceptable when there has been no
  qualifying 24-hour activity — the proof target is execution and safety, not a forced non-zero
  value.
- No synthetic activity rows are inserted into production, ever. Formula behaviour (non-zero
  computation and decay) is proven with isolated fixtures or staging, never in production. If
  production execution evidence is insufficient, stop and investigate rather than creating activity.
- Run twice to show idempotency (no runaway growth, no duplicate side effects).
- Final evidence must show: exactly one job named `refresh-trending-scores-v2-hourly`; no GitHub or
  browser trending scheduler; anonymous, non-admin and wrong-secret requests all rejected with 401;
  the valid Vault-backed invocation accepted; cron calls incremental mode, never bootstrap; two
  successive runs safe; all v2 scores within the bound; a dated correction in the B3 record; the
  3.5 predicate gone while normal entity-data validation stays; tests, typecheck and build pass.

## Stage 3 — remove the 3.5 Circle eligibility filter

Endorsement decides eligibility; rating may order but never veto. The average-rating drop in
`applyQualityFiltering` is removed at both call sites in the network recommendation service, and the
record notes it changes 0 of 81 current cases while intentionally keeping future low-average
explicitly endorsed items eligible.

## Stage 4 — hand back the final retirement list, then stop

Re-verify the B4A artefact table against the post-activation state and deliver the exact drop list
and migration order for 4.2B.4B — no `CASCADE`, stopping on any unexpected dependency. No drops,
no type regeneration, no schema changes to v1 artefacts in this stage.

## Not in this stage

No `DROP` of any v1 routine, table, column, index or materialized view. No regeneration of generated
database types. No Phase 4.3 work.

## Technical notes

- Function: `supabase/functions/update-trending-scores/index.ts` — add the dual-path guard
  (Vault-validated cron secret via a service-role-only validator, or admin JWT via `has_role`),
  mirroring `refresh-social-influence-v2`.
- Migration: `vault.create_secret` only if absent, `public.is_valid_trending_cron_secret(text)` with
  `SECURITY DEFINER`, `SET search_path = ''`, owner `postgres`, `REVOKE ALL` from
  `PUBLIC`/`anon`/`authenticated`, `EXECUTE` to `service_role`; then
  `cron.unschedule` guarded + `cron.schedule('refresh-trending-scores-v2-hourly', '20 * * * *', ...)`
  posting to the function with the Vault header and a 30s timeout.
- Client change: `applyQualityFiltering` in `src/services/networkRecommendationService.ts`
  (lines ~318–322) loses the `average_rating < 3.5` predicate.
- Documents: annotate `docs/verification/phase-4-2b3-consumer-cutover.md` with the scheduler
  correction; append the activation evidence and final drop list to
  `docs/verification/phase-4-2b4a-proof-gate.md`; update `roadmap.md`.
- Verification closes with tests, typecheck and build.
