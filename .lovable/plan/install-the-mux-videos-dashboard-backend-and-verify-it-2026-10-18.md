# Install the Mux Videos dashboard backend and verify it

## Steps
1. **Pre-checks (read-only):** Confirm the migration file is the final version: it contains the run-detail function, the fail-closed admin check and the BEGIN/COMMIT. Confirm what it needs already exists: the Phase 3 tables and functions, `has_role` and `app_role`. Confirm none of the new objects exist yet.
2. **Apply** `docs/drafts/mux-cleanup-dashboard-migration.sql` exactly as written, through the normal migration tool. If it fails, I check what is actually installed and report that, rather than assuming everything was rolled back. The migration stays installed afterwards; only the verification transaction is rolled back.
3. **Snapshot before testing:** save the exact rows below, so they can be compared field by field afterwards.
   - every candidate's ID, status, eligible_at, lifecycle_attempt, protection_reason, lease fields, destructive-claim fields and last_check_result;
   - the counts and newest IDs of runs, audit entries and observations.
4. **Verification transaction:** one short transaction with `lock_timeout` and `statement_timeout` set. It is always rolled back, including on any unexpected failure. Each check runs in its own exception block, so an expected permission error doesn't abort the rest.
   - A1–A6, read-only: non-admin refused, signed-out refused, limits capped, mode is dry_run, no cron job, unknown run returns nothing.
   - B1–B5, real worker calls: dry-run cap of 25, run ID linked, run detail shows only that run's history, a sweep has no history, a repeat call works. Inside the transaction, I record which real candidate IDs the workers evaluated.
   - C1, the two-session overlap test: BLOCKED.
   - D, failure path: a test-only stand-in made inside the rolled-back transaction.
5. **After the rollback,** check read-only:
   - every pre-existing candidate's fields match the snapshot exactly;
   - no test runs, audit entries or observations remain.
   Any difference is examined first. If it comes from normal app activity (for example, a user deleting a post), it is reported as that, not as test leakage. Cron is still absent and the mode is still dry_run.
6. **Screen:** I confirm that the admin functions are installed and answer correctly, so the "not installed" note no longer applies. The signed-in visual check is PENDING until you open the screen yourself.
7. **Report** every check as PASS, FAIL, BLOCKED or PENDING, then stop. No cron, no Mux deletion, no mode change, no protection overrides, no worker changes.
