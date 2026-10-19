# Phase 4 — Controlled live Mux deletion (DRAFTS ONLY)

Status: drafts prepared 2026-10-19. Nothing applied, deployed, scheduled or enabled.
`mux_cleanup_mode()` stays `dry_run`; the worker lives under `docs/` so it cannot deploy.

| File | Purpose | Evidence |
|---|---|---|
| `mux-cleanup-phase-4-migration.sql` | claim / pre-DELETE gate / finalize, exact-target allowlist, guard update | not executed |
| `mux-cleanup-phase-4-rollback.sql` | kill switch first, then removes live entry points; never removes barriers or audit rows | not executed |
| `worker/outcome.ts` | HTTP outcome matrix, budget, Retry-After, environment check | 12/12 Deno tests pass |
| `worker/index.ts` | service-role-only worker | type-checks; not deployed |
| `mux-cleanup-phase-4-db-tests-single-session.sql` | T1–T16 transitions/fencing | BLOCKED: needs isolated test DB |
| `mux-cleanup-phase-4-concurrency-test.py` | C1–C3 with two real connections | BLOCKED: needs isolated test DB |

## Constants
Max retries 5 · backoff 5 min × 2^(n-1), cap 6 h, Retry-After honoured (cap 6 h) · lease 120 s ·
worker deadline 55 s · per request 6 s · per-asset budget 22 s (pre-GET + DELETE + verify GET + finalize) ·
up to 10 claims per run (upper bound).

## Outcome matrix
DELETE 200/204 → deleted · DELETE 404 → verify GET (404 → reconciled_already_deleted; 200 → failed_manual;
429/5xx/timeout → retryable) · DELETE 429 → retryable + stop run · 5xx/network → retryable ·
401/403 → failed_manual `auth_error`, no retry increment, stop run · other 4xx → failed_manual ·
anything else → failed_manual. Retries exhausted → failed_manual. Crash/stale lease → recovered with same
destructive token, retry_count unchanged, zero-reference proof re-run.

## Environment evidence
Run start: GET `MUX_ENV_CANARY_ASSET_ID` (new secret) must return 200 with passthrough `app=commongroundz`, `env=live`.
Per asset: pre-DELETE GET must show matching passthrough and `meta.external_id = upload_record_id`.
Assets without that metadata (pre-Phase-2A) fail closed to failed_manual.

## Before any live activation (separate approvals)
1. Isolated test DB → run single-session + concurrency suites.
2. Production install of the migration.
3. Pick a disposable video, delete it in the app, wait the real 24 h grace, approve its exact candidate UUID + asset ID.
4. Deploy worker, set mode live, run once with exact target, set mode back to dry_run.
