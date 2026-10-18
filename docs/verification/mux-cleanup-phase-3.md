# Mux cleanup Phase 3 — review package (NOT APPLIED)

Status: prepared for owner review. No migration applied, no Edge Function deployed, no cron scheduled, no Mux deletion possible.

## Files
- `docs/drafts/mux-cleanup-phase-3-migration.sql` — schema, guards, triggers, dry-run worker, sweeper, privileges
- `docs/drafts/mux-cleanup-phase-3-rollback.sql` — refuses if any destructive claim exists; touches no content or Mux data
- `docs/drafts/mux-cleanup-phase-3-db-tests.sql` — 21 sequential rolled-back DB checks

## Changed objects (on apply)
Tables: `mux_deletion_candidates`, `mux_cleanup_audit_logs`, `mux_cleanup_observations` (service_role only, RLS on, no policies).
Triggers: `mux_cleanup_posts` (insert / soft delete / hard delete / media change), `mux_cleanup_reviews`, `mux_cleanup_review_updates` (insert / hard delete incl. cascade / media change), candidate guards, append-only guards.
Functions: lock, resolver, mode, enqueue, rescue, reference state, dry-run, sweep. EXECUTE revoked from PUBLIC/anon/authenticated.

## Decisions incorporated
- Barrier, not row, is immutable: claim flag/token/time/generation cannot change; only `deleting → deleted | reconciled_already_deleted | retryable_error | failed_manual` and `retryable_error → deleting | failed_manual`; terminal states final; rows cannot be deleted. In Phase 3 no claim can be created at all.
- Identity resolved via `mux_upload_id → mux_uploads.asset_id`; unresolved or mismatched identity is recorded in observations and never blocks a user's delete.
- Enqueue is idempotent (grace clock kept); only a new removal after rescue starts a fresh lifecycle; protected and claimed rows are never re-armed.
- `pending_grace → eligible` happens in the dry-run step after a fresh reference check under the asset lock; referenced → rescued, ambiguous → left as is.
- All age-only unlinked uploads are recorded as `protected_ambiguous` — no abandonment policy approved.
- Removed/orphaned mappings and mappings to deleted content do not protect forever; live mappings to existing content and in-flight uploads are ambiguous.
- Dry-run is pure SQL: no Mux call, no credential, no claim; leases are non-blocking; mode function hard-returns `dry_run`.

## Locking (honest limits)
- 64-bit `hashtextextended` advisory keys; collisions extremely unlikely, harmless if they occur (extra serialization only).
- Within one trigger call assets are locked in sorted order. Across separate statements or cascades in one transaction a global order cannot be guaranteed; Postgres deadlock detection would abort one transaction (retryable). The dry-run worker holds one asset lock at a time and takes no content row locks, so it cannot form a cycle with saves.

## Tests
| Area | Status |
|---|---|
| Deno/app tests | unchanged (no app or Edge code changed) |
| 21 DB checks | BLOCKED — not run; requires the migration applied to an isolated database. SQL tool here is read-only |
| Concurrency (save vs claim, stale worker, crash after DELETE) | BLOCKED — no live claims exist yet; deferred to live-activation package |

## Rollout steps after approval
1. Apply migration; 2. run DB tests in a transaction; 3. separately approve cron; 4. observe 48–72h of audit logs; 5. live worker is a separate future package.
