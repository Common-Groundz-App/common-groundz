# D2 (revised): safe server cleanup of photos removed from saved reviews and timeline updates

Review and timeline forms stay photo-only, the rollout switch stays off, and 3D isn't started. Both reviewers' corrections are folded in below.

## What changed from the last draft

1. **Unclear saves.** The database decides. If the edit committed, its removed photos are queued even when the browser timed out. If it rolled back, nothing is queued. Both cases are tested.
2. **One deletion path for saved photos.** Today, deleting a whole review thread returns a list of files that the browser then deletes directly, with no global check. That browser deletion is removed, so saved photos are only ever deleted by the new server cleanup.
   - The browser keeps cleaning up only photos uploaded in the current visit that were **never saved**, such as on Cancel. Those can't be shared or referenced.
   - The 3C "removed before save" cleanup is in the same category and stays.
3. **Not every link counts the same.** Each place is classified as:
   - **Keeps the file:** posts, reviews, timeline updates, entity photos, entity images and stored photos, entity suggestions (any status), entity products, profile avatar and cover, and photo reports while still open (moderation evidence).
   - **Doesn't keep the file:** cached photos and cached products (copies of outside images), notifications (an old snapshot that falls back to a placeholder if missing), and resolved photo reports.
   - **Ignored:** outside links, other buckets, Mux videos.

   One shared address reader feeds a separate keep/ignore policy. You can change any classification before I build.
4. **Real two-session race tests.** I'll run a throwaway local copy of the database here in the sandbox and drive two sessions at once, never touching live data. Covered:
   - attach then claim, and claim then attach;
   - removal at the same time as attachment;
   - overlapping edits;
   - several files locked in a fixed order.
5. **Worker claims with ownership.** Each claim gets a token and an expiry. Completion only counts if the token still matches. Tests cover two workers at once, an expired claim, and a crash after the storage delete but before the database records it; that last case gets resolved as "already missing" on retry.
6. **Photos we own only.** Only addresses on this project's own `post_media` bucket are recognised, plus valid bare paths. Video files and Mux assets are never deleted by this worker.
7. **Built switched off.** The worker ships with processing **disabled** through a server setting, and no schedule is turned on. Turning it off later stops processing without losing queue records.
   - After the tests pass, I report back. Enabling it and your one-photo test are a separate yes from you.
8. **Technical fixes:**
   - timeline updates get their own trigger (they have no cover image);
   - the "photo was removed" rejection uses a normal custom error code plus a readable marker, tested through the real review save and timeline save.

## How it works

```text
edit/delete commits -> trigger queues removed paths (same transaction)
save newly adding a path -> lock path -> reject if queued/deleting/deleted/failed
worker claim (token + lease, path lock, fixed order)
  -> final "keeps the file" check
       kept -> kept
       none -> deleting (committed) -> storage delete -> finish(token): deleted
       error / timeout -> retry with backoff; failed after 5; stale lease re-claimed
```

**States:** queued, deleting, deleted, kept and failed.
- A *kept* file that's removed again goes back to queued.
- A *deleted* file is never re-attachable.
- A *failed* file stays blocked and is listed for an admin.

**Shared files** are deleted only once nothing that keeps the file still uses it.

**Weekly sweep:** uses the same reader and policy, and stays report-only (execute mode hard-blocked). A dry run must keep the entity-suggestion photo and the 4 saved timeline photos.

## Tests

- **Throwaway local database** (two sessions):
  - every race above;
  - committed vs rolled-back unclear saves;
  - no queueing on unchanged edits or Cancel;
  - the guard checks only newly added paths, and shared files are never blocked;
  - the keep/ignore policy, including the entity-suggestion photo;
  - address forms, including lookalike outside links being ignored.
- **Worker** (Deno, storage stubbed): token mismatch, expired lease, crash after deletion, already-missing file, retries leading to failed, and running twice gives the same result.
- **App:** both save paths show "This photo was removed, please add it again". Thread deletion no longer deletes in the browser. Cancel cleanup still deletes only never-saved uploads.
- **Live, read-only only:** a dry-run sweep, plus confirming the migration created everything with processing off.

## Order of work

1. Local database harness with the current table definitions.
2. Migration: queue table, address reader, keep/ignore policy, triggers, guards, claim and finish functions, processing flag off.
3. Worker edge function, deployed with no schedule.
4. Remove the browser deletion of saved photos; add the rejection message.
5. Sweep update.
6. Run the tests and write the verification notes and roadmap.
7. Report and stop. Enabling and the one-photo test come next, separately.

## Technical details
- `media_deletion_candidates`:
  - columns: path unique, status, attempts, next_attempt_at, claim_token, lease_until, last_error, source, timestamps;
  - grants go to service_role only; RLS is on, with admin read through has_role.
- Functions: `normalize_owned_media_path(text)` matches only `https://uyjtgybbktgapspodajy.supabase.co/storage/v1/object/(public|sign)/post_media/…` or a bare `<uuid>/<uuid>/<file>`; `media_path_keep_count(path)`; `claim_media_deletions(n, lease)`; `finish_media_deletion(path, token, outcome, err)`.
- Locks: `pg_advisory_xact_lock(hashtextextended(path,0))`, taken in sorted path order.
- Error: `RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='MEDIA_PATH_RETIRED', DETAIL=path`, mapped in `serverErrors.ts`.
- `delete_review_thread` keeps returning `mediaToClean`, but the client ignores it. The DELETE triggers queue the paths instead.
- Processing flag: an `app_config` key `media_cleanup.processing_enabled=false`, read by the worker.
- One AGENTS.md rule ("saved media is deleted only by the server queue") is required by project conventions and is the only edit to that file.

## Final corrections (from both reviews)

1. **Re-checking "kept" files.** Instead of adding triggers to every table, the worker re-checks *kept* files every day. If nothing that keeps the file still uses it, the file goes back to queued, and from there the normal locked process takes over. This runs only when processing is on.
2. **Comparing the whole record.** Removed paths are worked out as *all old paths on the record minus all new paths*. For a review that means its media and cover image together; for a timeline update, its media. So a photo that's still the cover is never queued.
3. **Whole-thread deletion test.** Deleting a whole thread queues every saved photo from the review and its timeline updates exactly once. The browser no longer deletes them.
4. **While processing is off**, which is how it ships:
   - Queueing still happens. Re-adding a *queued* file is **allowed**. Under the same per-file lock, the save moves the record from *queued* to **kept**. The record is **never cancelled or erased**, so the history stays and the daily re-check can reconsider the file once processing is on.
   - Only *deleting*, *deleted* or *failed* files are rejected, so normal users are never blocked just because processing is off.
   - Nothing is ever deleted.
   - Changes from installing the migration: queue entries start appearing, saves that re-add a deleted or failed file are rejected, and the browser stops deleting files after a thread is deleted.
5. **Browser cleanup safeguards stay.** Cancel cleanup still runs only while the visit's save state is open, never while saving or unclear. Late uploads keep the 3B rules. Files are deleted only after a confirmed save, and only if they're absent from what was saved.
   - Added test: a timeout after a successful save, followed by leaving the page, deletes nothing that was saved.
6. **Locked-down functions.**
   - Running the claim, finish and re-check functions is revoked from public, anon and authenticated users; only the server role can run them.
   - Admins read through one read-only function that checks the admin role.
   - Tests prove signed-in non-admins and guests are refused.
7. **Realistic test database.** It's loaded with the real current table definitions, existing save and delete functions, triggers and permissions, taken read-only from the live schema. If it can't run, the race tests are reported as **blocked**, never replaced with mocks.
8. **Verifying the keep/ignore policy before building:**
   - confirm the cached tables only hold copies of outside images (zero `post_media` paths today);
   - confirm notification images fall back to a placeholder when missing.

   Anything unconfirmed is treated as "keeps the file".
9. **AGENTS.md.** This project's own instructions ask for each architecture decision to be recorded in AGENTS.md as one rule. One line is added there; it isn't a prerequisite.

**Still off afterwards:** processing, any schedule, the weekly sweep's delete mode, and the rollout switch. I report test results and blockers, then stop.

## Last clarifications (from the final reviews)

- **Re-attaching a queued file:** *queued* → **kept**, taken under the shared per-file lock, never cancelled or erased.
  - Once processing is on, the daily re-check runs: still referenced → stays *kept*; no references left → back to *queued*, then normal cleanup.
  - **Regression test:** remove → queued → re-attach while processing is off → kept → the last reference disappears → the daily re-check returns it to queued.
- **Guards stay on every table that keeps files.** The daily re-check only replaces extra removal triggers on other tables. It never replaces the guards that block new links while a file is being deleted.
- **The daily re-check uses the same per-file lock.** The check and the move back to *queued* happen in one transaction with the lock held. Two-session tests cover both orders (attach first, then re-check; re-check first, then attach), with processing both on and off.
- **What "turning processing off" means:**
  - it stops new claims;
  - the worker checks the setting right before each storage delete and skips the delete if processing is off;
  - a delete request already sent to storage may still finish and can't be undone, so the worker records it as *deleted*;
  - the run report lists any work that was in progress.
- **If the two-session tests can't run**, processing stays off and they're reported as blocked, never replaced with mocks.
- **Not approved yet:** turning processing on, and the live one-photo deletion test. Each needs a separate yes from you.
