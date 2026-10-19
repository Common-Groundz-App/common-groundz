# Phase 4 — Controlled live Mux deletion (DRAFTS ONLY, rev 2)

Status: revised 2026-10-19. Nothing applied, deployed, scheduled or enabled.
`mux_cleanup_mode()` stays `dry_run`; the worker lives under `docs/` so it cannot deploy.

| File | Purpose | Evidence |
|---|---|---|
| `mux-cleanup-phase-4-migration.sql` | run lease, claim, pre-DELETE gate, finalize, exact-target allowlist, guard, overview | parses (pglast); not executed |
| `mux-cleanup-phase-4-rollback.sql` | Stage 1 pause · Stage 2 teardown (refuses while leases live) | parses; not executed |
| `worker/outcome.ts` | HTTP outcome matrix, metadata contract, budget, Retry-After | 15 Deno tests pass |
| `worker/run.ts` | worker loop with injected I/O (fencing + RPC error handling) | 15 Deno tests pass |
| `worker/index.ts` | service-role-only Edge entry, wires I/O only | type-checks; not deployed |
| `mux-cleanup-phase-4-db-tests-single-session.sql` | L1–L9, C1–C7, R1–R4, G1–G8, F1–F12, P1–P7 | BLOCKED: isolated test DB |
| `mux-cleanup-phase-4-concurrency-test.py` | C1–C6 with independent connections | compiles; BLOCKED: isolated test DB |
| `dashboard-compat.md` | ledger contract + frontend patch for live rows | draft |

## Fences
- **Global run lease** (`mux_cleanup_live_run_lease`, one row): acquisition mints a fresh token and
  bumps `generation`. Claims need the token with ≥30 s left; the pre-DELETE gate needs mode `live`,
  the token with ≥10 s left, and the candidate lease with ≥20 s left. Takeover only after expiry; the
  stale run's next gate/claim fails and its release cannot touch the newer holder.
- **Candidate lease** (Phase 3 fields): finalize requires matching **and unexpired** lease; does not
  require live mode, so pausing lets in-flight requests settle.
- Order: candidate lease 120 s > run lease 90 s > deadline 55 s + gate margin 10 s; margin > 6 s request timeout.

## Constants
Max retries 5 · backoff 5 min × 2^(n-1), cap 6 h, Retry-After honoured (cap 6 h) · per request 6 s ·
per-asset budget 22 s · up to 10 claims per run · `mux_live_exact_only() = true`.

## Outcome matrix
pre-GET 404 → reconciled_already_deleted · pre-GET metadata mismatch → failed_manual ·
DELETE 200/204 → deleted · DELETE 404 → verify GET (404 → reconciled; 200 → failed_manual;
429/5xx/timeout → retryable) · 429 → retryable + stop · 5xx/network → retryable ·
401/403 → failed_manual, no retry increment, stop · other 4xx / anything else → failed_manual ·
retries exhausted → failed_manual · gate refused → aborted_before_delete (no increment, stop).
Any claim/gate/finalize RPC error or `accepted=false` stops the run.

## Mux GET metadata contract
Source: `mux-create-upload/metadata.ts` writes `meta.external_id = upload_record_id` and
`passthrough = JSON {v:1, app:'commongroundz', env, kind, upload_record_id}`. Phase 2 owner
verification confirmed both on a real production asset's GET response. Canary: 200, v=1,
app, env=`live`, ids consistent. Per asset: same plus `upload_record_id` = candidate's. Anything
absent or different fails closed (pre-Phase-2A assets → failed_manual). Re-confirm with one
read-only GET of the chosen canary during the rehearsal.

## Exact target
Approval (unconsumed, unexpired, matching asset) is required for every **new** destructive claim
while exact-only is on. It never blocks retry/recovery/finalize of an already-claimed asset.

## Before any live activation (separate approvals)
1. Isolated test DB → run single-session SQL suite and concurrency script; record results.
2. Production install of the migration (mode still dry_run) + dashboard patch.
3. Choose canary asset, set `MUX_ENV_CANARY_ASSET_ID`; read-only GET confirms contract.
4. Disposable video: delete in app, wait the real 24 h, approve exact candidate UUID + asset ID.
5. Deploy worker, set mode live, run once with exact target, set mode back to dry_run.
