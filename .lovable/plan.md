# Install the Mux Videos dashboard backend and verify it

## Steps
1. Apply `docs/drafts/mux-cleanup-dashboard-migration.sql` exactly as written: the run log, the admin functions including run detail, and the run wrappers. It goes through the normal migration tool and keeps its own BEGIN/COMMIT. If any statement fails, stop and report the exact error.
2. Run the verification checklist from `docs/verification/mux-cleanup-dashboard.md` in one rolled-back transaction:
   - A1–A6, read-only: non-admin refused, signed-out refused, limits capped, mode is dry_run, no cron job, unknown run returns nothing.
   - B1–B5, real worker calls: dry-run cap of 25, run ID linked, run detail shows only that run's history, a sweep has no history, a repeat call works. Before rolling back, record the IDs of any real candidates the workers evaluated.
   - C1, the two-session overlap test: BLOCKED.
   - D, failure path: a test-only stand-in that copies the wrapper's error handling, made inside the same rolled-back transaction.
3. After the rollback, confirm read-only that nothing was left behind:
   - no run rows from the tests;
   - candidate counts and statuses match the snapshot taken before;
   - no new audit rows;
   - no cron job, and the mode is still dry_run.
4. Confirm the Mux Videos screen now loads the real data instead of the "not installed" note. I check that the admin functions exist and answer correctly. A signed-in visual check depends on browser access to your admin session.
5. Report every check as PASS, FAIL or BLOCKED, then stop. No cron, no live deletion, no mode change, no changes to the worker.
