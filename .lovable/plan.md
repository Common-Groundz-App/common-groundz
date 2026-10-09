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
