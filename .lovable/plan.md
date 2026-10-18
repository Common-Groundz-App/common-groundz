# Mux Videos dashboard: run-detail lookup, then build the screen

Both reviews are right, and they fit together: ChatGPT asks for one small database addition, and Codex says the screen can be built now while applying the database changes stays a separate approval.

## 1. Database draft (files only, nothing applied)
- Add `admin_mux_cleanup_run_detail(p_run_id uuid)` to the v2 migration:
  - uses the same fail-closed admin check;
  - returns the run's allow-listed fields (same projection as the run list);
  - when `worker_run_id` is set, returns up to 50 matching history rows (`id, run_id, mode, action, details, created_at`), newest first with the ID as a tie-breaker, plus a `audit_truncated` flag;
  - sweeps (no `worker_run_id`) return an empty list;
  - unknown run ID returns null.
- Add its revoke/grant lines, and add it to the rollback script.
- Worker contract, already checked against the installed functions: the dry run returns exactly one shape (`run_id, mode, would_delete, rescued, ambiguous`) and the sweep returns exactly one shape (`protected_recorded`). Neither has a "busy" or "failed" result; errors are raised. So the wrapper's success rule (an object, plus a valid `run_id` for dry runs) matches the real contract. A short comment in the SQL records this.
- Transaction ownership: still unmeasured. Before applying, I run the small probe from the earlier Phase 4 plan (a throwaway table plus a forced error, no real data). Its result decides whether the file keeps its own `BEGIN`/`COMMIT` or drops those two lines. Nothing else changes.
- Worker and cleanup lifecycle are not touched.

## 2. Build the Mux Videos screen (frontend only)
- Media Cleanup tab gets two sub-tabs: **Storage Photos** (both existing cards, unchanged) and **Mux Videos**.
- Mux Videos contains:
  - the overview cards (mode, four-state schedule, status counts, leases, last runs);
  - the candidate table with filters, search and paging;
  - the candidate detail drawer;
  - the observations list;
  - run history, where clicking a run opens its exact history entries through the new lookup;
  - the live inventory dialog;
  - Run Sweeper / Run Dry-Run buttons with confirmation.
- "Stale (no completion recorded)" label for runs still running after 10 minutes.
- Skeleton loading. Because the database changes aren't applied yet, the screen shows a plain "dashboard backend not installed yet" note instead of breaking.
- Check that Storage Photos behaves exactly as before.

## 3. Verification procedure (written, not run)
A document listing every check with its exact SQL and expected result, grouped by effect:
- **Read-only:** non-admin refused, limits clamped, mode is `dry_run`, no cron job, schedule state.
- **Writes synthetic data inside BEGIN/ROLLBACK:** run detail returns linked history, the dry-run cap of 25, `worker_run_id` saved.
- **Takes locks / calls workers:** the sweep and dry-run wrappers. These use only synthetic records and are rolled back.
- **Failure path:** a test-only wrapper in the same rolled-back transaction raises inside the protected block. No disabling of triggers, no replacing of production functions, no changes to real content.
- **Blocked:** the two-session overlap test, because I can't open independent sessions here.
- **Stated limitation:** a dropped connection or aborted transaction leaves no history entry. Only errors caught inside the protected block are recorded.

## 4. Stop
Show you the updated SQL, the finished screen and the verification procedure. Applying the database changes is then a separate approval. No Mux deletion, no mode change, no protection overrides, no cron.
