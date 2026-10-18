# Mux cleanup dashboard — verification procedure (NOT RUN)

Status: the SQL in `docs/drafts/mux-cleanup-dashboard-migration.sql` is not applied. The UI is built and shows "Dashboard backend not installed yet" until it is.

## How the migration will be applied
The same migration tool that applied Phase 3 is used. Its transaction behaviour isn't documented and no production probe is run. The file therefore keeps its explicit `BEGIN`/`COMMIT`. If the tool is confirmed to wrap the file itself, only those two lines are removed.

## Checks (run only after the migration is approved and applied)
All checks run in one `BEGIN … ROLLBACK`. The admin session is simulated with
`SELECT set_config('request.jwt.claims', json_build_object('sub', <admin uuid>)::text, true);`, and a non-admin session with a random UUID.

### A. Read-only
| # | Check | SQL | Expected |
|---|---|---|---|
| A1 | Non-admin refused | non-admin claims; `SELECT admin_mux_cleanup_overview();` (repeat for every admin_* RPC) | error 42501 `admin only` |
| A2 | No session refused | claims unset; same calls | 42501 |
| A3 | Limits clamped | `SELECT jsonb_array_length(admin_list_mux_candidates(p_limit=>100000)->'rows') <= 100` | true |
| A4 | Mode | `SELECT admin_mux_cleanup_overview()->>'mode'` | `dry_run` |
| A5 | No cron job | `admin_mux_cleanup_overview()->'schedule'->>'state'` | `not_scheduled` or `scheduler_unavailable` |
| A6 | Unknown run | `SELECT admin_mux_cleanup_run_detail(gen_random_uuid())` | NULL |

### B. Takes locks / calls the real workers (rolled back)
`mux_cleanup_sweep()` and `mux_cleanup_dry_run()` act on the **whole** cleanup queue, not just test rows. During these checks, real existing candidates and uploads can also be evaluated. They can be leased, promoted, recorded or audited until the rollback. Before the rollback, the report lists which real candidate IDs were touched. No Mux video can be deleted (dry-run mode only, no Mux calls), real Posts/Reviews/Timeline Updates are never changed, and locks last only for the test transaction.
| # | Check | Expected |
|---|---|---|
| B1 | `admin_run_mux_dry_run(1000)` → run row `batch_limit` | 25 |
| B2 | Same run: `worker_run_id` equals `result->>'run_id'` | true |
| B3 | `admin_mux_cleanup_run_detail(run id)->'audit'` rows all have `run_id = worker_run_id`; ≤ 50; `audit_truncated` boolean | true |
| B4 | `admin_run_mux_sweep()` → run detail `audit` | `[]` |
| B5 | Second call in same transaction | succeeds (same session already holds the xact lock; true overlap is C1) |

### C. Blocked
- C1: two-session overlap (`run_already_in_progress`). Blocked, because independent concurrent sessions can't be opened here.

### D. Failure path
A test-only function created inside the rolled-back transaction, `p_dash_fail_worker()`, is called through a copy of the protected-block pattern, and the resulting ledger row is asserted to be `failed` with a sanitized `error_message`. Triggers are not disabled, production functions are not replaced, and real content is not modified. Note: this tests the pattern itself, not the installed wrapper's own call to the worker.

## Stated limitations
- A dropped connection or aborted transaction leaves no ledger row. Only errors caught inside the protected block are recorded. Runs still `running` after 10 minutes show as "Stale (no completion recorded)".
- These are rolled-back checks on production, not isolated verification.
- Rollback drops `mux_cleanup_runs`, so dashboard run history is lost. Audit logs are kept.

## Results — 2026-10-18 (migration APPLIED)
Pre-snapshot: 0 candidates, 0 audit, 0 observations, no mux cron jobs (6 unrelated jobs).
All checks ran inside DO blocks that end with a forced exception, so all writes were rolled back.
| Check | Result |
|---|---|
| A1 non-admin refused (all 8 RPCs) | PASS |
| A2 signed-out refused | PASS |
| A3 limit clamped to 100 / negative offset clamped | PASS |
| A4 mode dry_run | PASS |
| A5 schedule state | PASS (not_scheduled) |
| A6 unknown run → null | PASS |
| B1 dry-run batch capped at 25 | PASS |
| B2 worker_run_id linked | PASS |
| B3 run detail: 1 row, only this run, allow-listed fields, truncation flag false | PASS (2nd attempt; the 1st hit a test-variable name clash in the test code, not a migration bug) |
| B4 sweep: no history, worker_run_id null | PASS |
| B5 repeat call in same transaction | PASS |
| B6 run list hides triggered_by | PASS |
| C1 two-session overlap | BLOCKED |
| D failure path (test stand-in) | PASS |
| Post-rollback: 0 candidates, 0 synthetic, 0 audit, 0 observations, 0 runs, no mux cron | PASS |
| Signed-in screen check | PENDING (owner) |
Real rows evaluated before rollback: dry run 0 (queue was empty); sweep captured 72 real old unlinked uploads as protected_ambiguous (rolled back).
