# D2 into normal operation: hourly cleanup, admin controls, and a monitoring view

D2 is already marked complete and verified in the audit notes and the roadmap.

## Recommended cadence: once an hour
- That's 24 runs a day. Each run handles up to 25 photos.
- The worst case is that a removed photo stays in storage for about an hour. Nobody sees it, because it's no longer attached to anything, and the database already blocks it from being re-attached.
- Running every 5–10 minutes means 144–288 runs a day. Every run checks the database and starts the worker even when there's nothing to do, which uses resources and can add cost for no visible benefit. With today's traffic, the queue is empty almost all the time.
- If the queue ever builds up, we can make it run more often later. That's a one-line change.

## What changes
1. **Turn processing ON** through the same audited switch the other admin flags use. This records who changed it, when, and why.
2. **Add an hourly schedule** named `process-media-deletions-hourly`, at minute 40 so it doesn't overlap the other hourly jobs.
   - It calls the existing worker with the cleanup password that is already stored in the database's secret vault, the same way the weekly report does. No password is ever written in plain text.
   - The worker itself stays exactly the same: reference rechecks, per-file locks, 5-minute leases, retries and failure handling. Turning the switch OFF still stops deletions even while the schedule keeps firing.
3. **Unchanged:** the weekly sweep (report-only), the review page switch (OFF), and 3D (not started).

## Admin page: new "Saved-photo cleanup" card in the existing Media cleanup panel
- **Status:** processing ON or OFF, and whether the hourly schedule exists and is active.
- **Last run:** when the worker last ran and its result (deleted, retry, failed, stale).
- **Counts by state:** queued, deleting, kept, retrying, failed and deleted.
- **Alerts:**
  - **Failed:** any photo whose retries ran out is shown in red, with its error.
  - **Stuck:** any photo still marked "deleting" more than 15 minutes after its lease ran out.
  - **Retrying:** any photo that is being retried, with its attempt count.
  - **Overdue:** any photo that has been queued for more than 3 hours.
- **List:** the 50 most recent cleanup entries, showing path, state, attempts, last error and times. You can filter by state.
- **Pause / Resume:** one button that flips the switch, with a confirmation and a reason box. Pausing takes effect before the next file is deleted, and the schedule stays in place.
- **Run now:** a button that triggers one run straight away, admins only. The password stays on the server.

## How the worker is triggered
The database's scheduler calls `process-media-deletions` once an hour with the stored password. The new admin-only "Run now" button calls a new admin-checked function, which calls the same worker on the server side. Nothing else can start it.

## How we verify it's running correctly
1. Read-only checks before and after: processing ON, the schedule listed as active, and the queue counts.
2. Press "Run now" with an empty queue. It should return "claimed 0", show up as the last run in the card, and delete nothing (the photo count stays at 264).
3. You test it for real: edit a throwaway review and remove one photo. It's queued straight away, and within the hour it's marked "deleted" and the file is gone. Your other photos are untouched.
4. After 2 scheduled runs, the run history shows one run per hour with no errors.

## How to pause quickly
- **Fastest:** the Pause button in the admin card. Deletions stop before the next file; anything mid-claim gets picked up again later, safely.
- **Full stop:** I can remove the hourly schedule with one change. The queue keeps filling, nothing is lost, and resuming later processes the backlog.

## Technical details
- **Flag:** extend `set_app_flag` to allow `media_cleanup.processing_enabled` (value `{"enabled": bool}`). Update `media_cleanup_processing_enabled()` to read `value->>'enabled'`, and also accept the current bare boolean so it never fails open or closed by mistake. Add the key to `ALLOWED_KEYS` in `useAppFlagsAdmin.ts`. Turning it on goes through `set_app_flag` with a reason.
- **Schedule (data insert, not a migration, because it contains the project URL):**
  ```sql
  select cron.schedule('process-media-deletions-hourly', '40 * * * *', $$
    select net.http_post(
      url := 'https://uyjtgybbktgapspodajy.supabase.co/functions/v1/process-media-deletions',
      headers := jsonb_build_object('Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cleanup_cron_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 60000);
  $$);
  ```
- **Run log:** a new service-role-only table, `media_deletion_runs`, with started/finished times and the report fields as JSON. The worker inserts one row per run. GRANTs go only to service_role, and RLS is on.
- **Admin read:** a new security-definer RPC, `admin_media_deletion_status()`, checks `has_role(auth.uid(),'admin')` and returns the flag, the cron job state (from `cron.job`), the last 10 runs, counts by status, and the failed, stuck, retrying and overdue counts. The list reuses the existing `admin_list_media_deletion_candidates`.
- **Run now:** a new edge function, `admin-media-deletions-trigger`. It checks the admin JWT with `has_role`, then calls `process-media-deletions` with `CLEANUP_CRON_SECRET` on the server side. It's modelled on `admin-media-cleanup-trigger`.
- **UI:** a new `AdminMediaDeletionQueueCard`, rendered inside `AdminMediaCleanupPanel`. It uses skeleton loading, and the panel's existing sweep sections are unchanged.
- **Tests:** the existing worker tests still pass, plus a test for the run-log insert, a check that the status RPC refuses non-admins, and a privilege check that clients can't read `media_deletion_runs`.
