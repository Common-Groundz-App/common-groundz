# Admin "Mux Videos" cleanup dashboard (final, with ChatGPT/Codex corrections)

A view of the video cleanup system, plus manual buttons to run the sweeper and the dry run. Nothing in this package can delete a video, turn on live mode, override a protection or schedule anything.

## Layout
- The Media Cleanup tab gets two sub-tabs: **Storage Photos** and **Mux Videos**.
- Storage Photos keeps both existing cards, unchanged: the cleanup panel and the saved-photo deletion queue card.
- Mux Videos contains:
  - **Overview cards:** the mode and the schedule status. Both are read from the backend, and the schedule shows "Not scheduled" when there isn't one. It also shows counts by real status (pending_grace, eligible, rescued_referenced, protected_ambiguous, deleting, deleted, reconciled_already_deleted, retryable_error, failed_manual), active leases, and the last sweep and last dry run.
  - **Candidate table:** filters by status, source_kind, enqueue_reason and protection_reason. You can search by mux_asset_id or upload_record_id. The list is paged on the server and rows can be copied by Asset ID.
  - **Detail drawer:** the candidate's fields, its recent audit history (up to 50 entries), and a live reference check. The reference check shows content type, content UUID, whether that content is active or deleted, and how it matched (mux_upload_id or a resolved asset). It shows no titles or comment text.
  - **Observations list:** paged, with a filter by kind.
  - **Run history:** taken from a new run log.
  - **Live Mux inventory dialog:** calls the existing read-only inventory function.
  - **Run Sweeper / Run Dry-Run buttons:** each asks for confirmation. The dry run is capped at 25.
- Empty results are worded honestly. For example, "Run completed: 0 evaluated" is shown together with the remaining queue counts. It never says "queue clean".

## Corrections included
1. **Search uses real fields only.** Candidates have no source_id column, so search doesn't use one. Originating content IDs come only from the live reference inspector.
2. **A real mutex.** One shared lock, `pg_try_advisory_xact_lock(hashtextextended('mux_cleanup:manual_run',0))`, covers both sweep and dry run. If the lock is taken, the call returns `run_already_in_progress`. The run log row is only for record-keeping. It is not the lock.
3. **Failed runs stay recorded.** The wrapper inserts the run row, then runs the worker inside a protected `BEGIN … EXCEPTION` block. On error, the worker's partial work is rolled back. The run row is then updated to `failed` with a finish time and a cleaned-up error message (SQLSTATE plus a short message), and the call returns `{ok:false, error}`. Limitation: if the connection drops, the whole transaction rolls back and no row remains, so we don't promise a record in that case. If a row is still `running` after 10 minutes, the dashboard shows it as **Stale (no completion recorded)**. Nothing changes the row automatically.
4. **Reference match types** are limited to the paths that really exist (mux_upload_id, and asset resolution through mux_uploads). Playback IDs aren't used.
5. **No text snippets** in the inspector.
6. **Run correlation.** `mux_cleanup_runs.worker_run_id uuid` stores the `run_id` that `mux_cleanup_dry_run()` returns, so one dashboard run links to its exact audit rows. The tested worker itself is unchanged. For sweeps this stays null.
7. **Shared lock helper.** `mux_cleanup_try_run_lock()` uses a single key convention, so a future cron job can take the same lock as manual runs. No cron is added now.
8. **Scheduler states.** "Not scheduled" means the scheduler was checked and has no job. "Scheduler unavailable" means it couldn't be checked, which is not proof that no job exists. They are shown as separate states.

## Delivery steps
1. Write the migration and rollback SQL as files: the `mux_cleanup_runs` table (service-role only, RLS on, no policies) plus the admin RPCs. Every RPC is SECURITY DEFINER with `search_path = pg_catalog, public`, uses schema-qualified objects, checks `has_role(auth.uid(),'admin')` and fails closed, and clamps limits and offsets. EXECUTE is revoked from PUBLIC/anon and granted to authenticated, with the admin check inside the RPC.
2. Show you the migration and rollback for approval, then apply them as a separate step.
3. Run the database checks inside BEGIN/ROLLBACK:
   - non-admin is refused;
   - limits are clamped;
   - a forced worker error leaves a `failed` row;
   - the dry-run cap of 25 holds;
   - worker_run_id is saved;
   - the mode is still dry_run;
   - there is no cron job.
   - The two-session mutex test is reported as BLOCKED, because I can't open independent concurrent sessions here.
   - These are rolled-back checks on production, not isolated verification, and the report will say so.
4. Build the UI. Then check that the Storage Photos sub-tab still works the same, and stop for your UI testing.

## Technical details
- RPCs: `admin_mux_cleanup_overview()`, `admin_list_mux_candidates(p_status, p_source_kind, p_reason, p_search, p_limit, p_offset)`, `admin_mux_candidate_detail(p_id)` (fields, the last 50 audit entries and live references), `admin_list_mux_observations(p_kind, p_limit, p_offset)`, `admin_list_mux_cleanup_runs(p_limit)`, `admin_run_mux_sweep()`, `admin_run_mux_dry_run(p_batch)` (capped at 25).
- The schedule status reads from `cron.job` if that's available. If not, it shows "Not scheduled / scheduler unavailable".
- Components: `AdminMuxCleanupPanel`, plus the drawer and dialog, which use skeleton loading.
- Out of scope: live deletion, changing the mode, overriding protections, and cron.
