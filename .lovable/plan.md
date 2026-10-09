# D2: safe cleanup of photos removed from saved reviews and timeline updates

Review and timeline forms stay photo-only, the rollout switch stays off, and 3D isn't started. The manual orphan cleanup is marked complete, and the empty-folder marker is left as-is.

## What you'll get

When someone removes an already-saved photo and the edit is saved, the server deletes that file shortly afterwards. It only does this when nothing else on the platform uses the file. Nothing is deleted on Cancel, a failed save or an unclear save. Old files can never be silently pulled out from under live content.

## How it works

```text
edit saved (same database transaction)
  -> removed photos queued
worker (every few minutes, plus a retry pass)
  -> lock file -> full reference check
       referenced   -> kept
       unreferenced -> deleting (committed) -> storage delete -> deleted
       error        -> stays deleting/queued, retried; failed after 5 tries
```

1. **Queue record, one per file.** Each record holds:
   - the path, the bucket (`post_media` only), which record and field it came from, and the time queued;
   - the status: queued, deleting, deleted, kept or failed;
   - the number of attempts, the next try time and the last error.

   A file that's queued again while *kept* goes back to queued. A file that's *deleted* is never queued again.
2. **Queueing in the same transaction.** Triggers on reviews (media and cover image) and on timeline updates (media) fire after an update or delete. They queue *old paths minus new paths*.
   - Cancel never writes. A failed save rolls back its queue entry with it. An unclear save is decided by what actually committed.
   - Whole-thread deletion and latest-update deletion are covered by the same triggers.
   - The current browser cleanup for thread deletion stays as-is; both paths are safe to run together.
   - The 3C browser cleanup of unsaved new uploads stays unchanged. Those files were never saved, so they're never queued.
3. **One shared address function.** Full public addresses, signed addresses and bare paths all reduce to one standard `post_media` path. Query strings and encoding are stripped and letter case is kept. Anything outside `post_media` (outside links, other buckets) is ignored and never queued.
4. **One lock per file.** Queueing, the worker's claim and every save that *newly adds* a path take the same short database lock on that path. The lock never spans the storage call. Instead, the *deleting* state is committed first.
5. **Blocking re-attachment.** Guard triggers on every place media can be linked from check only paths that are *new* in a save. Paths the record already had are never checked.
   - A new path that's queued, deleting, deleted or failed is rejected with a clear code.
   - The forms show it as "This photo was removed, please add it again."
   - Unrelated edits and records already sharing a file are never blocked.
6. **Final reference check** across every location in the coverage list, run inside the claim transaction under the lock. Any reference → *kept*.
7. **Storage deletion** by a new service-role edge function through the storage API. A file that's already missing counts as success. It then marks the file *deleted*.
8. **Retries and uncertainty.**
   - A timeout or error keeps the file in *deleting* or *queued* and it's retried with backoff. Retrying is always safe to repeat.
   - After 5 tries the file becomes *failed* and stays blocked from re-attachment.
   - An admin can see failed and stuck files; nothing is ever force-deleted.
   - A file stuck in *deleting* for more than an hour is re-checked and retried.
9. **Shared files.** A file used by two records is kept until both stop using it. When the second edit removes it, it's queued again and then deleted.

## Coverage (one shared reference function)

- **Posts:** posts.media (each item's address and thumbnail).
- **Reviews:** reviews.media and reviews.image_url.
- **Timeline updates:** review_updates.media.
- **Entities:** entity_photos.url; entities.image_url and stored_photo_urls; entity_suggestions.suggested_images; entity_products.image_url.
- **Profiles:** profiles.avatar_url and cover_url.
- **Other:** cached_photos (3 address columns), cached_products.image_url, notifications.image_url, photo_reports.photo_url.

The same function drives the worker check, the guards and the weekly sweep.

## Weekly sweep

The sweep uses the shared reference function so its coverage matches. It stays **report-only**: the execute mode gets a hard block while queue-based cleanup is the active path.

A dry run must show the entity-suggestion photo and the 4 saved timeline photos as kept.

## Tests

- **Database tests** (run against throwaway rows inside a transaction that is always rolled back, so no live data changes):
  - queue on removal;
  - no queue on an unchanged edit, a failed save or a rolled-back save;
  - guard rejects re-adding a queued, deleting, deleted or failed file;
  - guard allows unchanged shared paths;
  - a two-session race: the save waits for the claim and is then rejected or kept as designed;
  - the final check keeps shared files and the entity-suggestion photo;
  - address normalisation covers every form.
- **Worker tests** (Deno), with the storage call stubbed:
  - missing file counts as success;
  - errors retry, then mark failed;
  - running twice gives the same result;
  - a stuck *deleting* file is recovered.
- **App tests:** Cancel, a failed save and an unclear save queue nothing; the "photo was removed" message shows.
- **Live check** (read-only plus one approved real step):
  - after building, you remove one saved test photo in Edit;
  - I verify it was queued, then deleted, and that the other photos remain.

## Order of work

1. Database migration: queue table (admin and server access only), address function, reference function, guard and queue triggers, claim function.
2. Worker edge function plus schedule.
3. Sweep update with execute blocked.
4. Small form message for the rejection code.
5. Tests, then verification notes, roadmap and the AGENTS.md rule.
6. Report back and stop.

## Technical details
- Table: `media_deletion_candidates(path text unique, bucket, source_table, source_id, status, attempts, next_attempt_at, last_error, timestamps)`.
  - Access is granted to service_role only; RLS is on with admin read only. `authenticated` gets no write access; the triggers are SECURITY DEFINER.
- Functions:
  - `public.normalize_media_path(text)`
  - `public.media_paths_from_jsonb(jsonb)`
  - `public.media_path_reference_count(text)`
  - `public.claim_media_deletion_batch(n)`: `FOR UPDATE SKIP LOCKED` plus `pg_advisory_xact_lock(hashtextextended(path,0))`, and `public.finish_media_deletion(path, ok, err)`.
- Triggers:
  - `AFTER UPDATE OF media, image_url OR DELETE` on reviews and review_updates, for queueing;
  - `BEFORE INSERT OR UPDATE` guards on every covered table, checking only paths that are new compared with OLD.
- Worker: `process-media-deletions` (service role, cron secret), batches of 25, every 5 minutes through the existing pg_cron.
- Error code `MEDIA_PATH_RETIRED` is mapped in `serverErrors.ts`.
