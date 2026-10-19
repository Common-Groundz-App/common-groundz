# Mux cleanup Phase 3 — COMPLETE (2026-10-19)

Status: migration APPLIED, all DB checks PASS, dashboard backend APPLIED and verified, owner QA on the admin screen PASS. Phase 3 is closed.

## What Phase 3 delivered
- Tables: `mux_deletion_candidates`, `mux_cleanup_audit_logs`, `mux_cleanup_observations` (service_role only, RLS on, no client policies).
- Triggers: `mux_cleanup_posts` (insert / soft delete / hard delete / media change), `mux_cleanup_reviews`, `mux_cleanup_review_updates` (insert / hard delete incl. cascade / media change), candidate guards, append-only guards.
- Functions: lock helpers, canonical resolver (`mux_uploads.asset_id`), mode (hard `dry_run`), enqueue, rescue, reference state, dry-run worker, age-only sweeper. EXECUTE revoked from PUBLIC/anon/authenticated.
- Dashboard backend: service-only run ledger (`mux_cleanup_runs` with `worker_run_id` correlation), fail-closed admin RPCs (overview, candidate list/detail, observations, run list, run detail, manual dry-run, manual sweep).

## Verified behavior
- Active Post hard-delete → candidate with 24h grace; already-soft-deleted historical Post purge → `protected_ambiguous` (`historical_soft_deleted_pre_phase3`); existing candidates preserved idempotently, grace clock never reset.
- Universal lock order: asset advisory lock (`hashtextextended`, 64-bit) BEFORE candidate row lock; worker processes assets in lexical order.
- Dry-run promotes `pending_grace → eligible` only after a fresh zero-reference check under the asset lock; referenced → rescued; ambiguous left as is.
- Age-only unlinked uploads → `protected_ambiguous`, never deletion-eligible (72 real historical uploads confirmed via sweeper).
- `pending_grace → eligible → dry-run simulated deletion` lifecycle verified live with a real deleted post video; no Mux DELETE possible (mode hard-returns `dry_run`, destructive claims raise 42501).
- Dashboard verification (docs/verification/mux-cleanup-dashboard.md): A1–A6, B1–B6, D PASS; C1 (two-session overlap) BLOCKED.

## Deferred (intentionally, to live-deletion activation)
- True parallel/concurrency tests (two-session claim overlap, crash after Mux DELETE) — they concern the destructive claim / Mux DELETE boundary.

## Phase 4 (not started, needs separate approval)
- pg_cron scheduled dry-run (credentials via Supabase Vault), 48–72h audit observation, then a separately approved live deletion worker.
