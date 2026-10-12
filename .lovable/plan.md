# Phase 1: concurrency tests — final runnable SQL Editor package (John Carter)

Video uploads stay off. Phase 2 stays on hold until these results are reported.

## Confirmations (all done, nothing left "to confirm")

| Item | Result |
|---|---|
| John Carter `06261a67-ebd7-43db-afe2-c3218e118473` | Profile exists; 0 reviews, 0 updates, 0 uploads |
| Test subject `027b88ee-18b9-44d5-8c60-46626d707df4` | Type `brand`, 0 reviews, no John review (no one-per-subject clash) |
| Fixed IDs below | None exist yet (checked) |
| Upload status values | `waiting, asset_created, ready, errored, cancelled` |
| Link status values | `pending, patched, removed, orphaned, errored` |
| `patch_content_media_from_mux(p_mapping_id uuid) returns text` | Signed-in users can't call it. For reviews it hands off to `patch_review_media_from_mux`. That function locks the review/update row first, then the link. It returns `patched` / `noop_removed` / `noop_already_patched` / `noop_not_ready` / `noop_orphaned` / `noop_errored` |
| Trusted server context | `is_trusted_server_context()` = no signed-in user and role empty or `service_role`. The SQL Editor runs as `postgres` with no user, which counts as trusted. That's the same context the Mux webhook uses |
| "Acting as John" inside `DO` | `EXECUTE 'set local role authenticated'` + `set_config('request.jwt.claims', …, true)` inside a `DO` block. This exact pattern ran 39 times on this database in the Phase 1 tests, through the same `postgres` SQL path the SQL Editor uses. It only lasts for that one statement |
| Locks involved | Timeline insert: takes a per-review advisory lock, then the video rule locks the parent review row (`FOR UPDATE`). Visibility change / media edit: the review row lock. Mux patch: the review row lock, then the link |
| Side rows created by a timeline insert | None in other tables. It updates the review's timeline count, latest rating and `updated_at` (cleaned up with the review) |
| Side rows created by the review | 1+ `embedding_trigger_log` rows (cleaned by exact `record_id`). 1 background embedding request through `net.http_post`: its response row lives in Supabase's internal `net` schema, expires on its own and isn't touched. Video links (cleaned by exact IDs) |
| Photo cleanup queue | The test photo is a fake `example.com` URL, not a storage path, so nothing is queued. Cleanup still deletes any queue rows whose `source_id` is one of the exact test IDs |
| Rows that delete along with the review automatically | `review_likes`, `review_saves`, `photo_reports` (none will exist). `user_entity_journeys` doesn't delete automatically; a read-only check confirms 0 rows |
| Entity stats | The live entity stats read straight from reviews, so they go back to normal right after cleanup. The hourly stats summary could show the test review if its refresh falls during the test. If so, the next hourly refresh corrects it. Nothing else changes |
| Different connections | The watch query lists each tab's backend `pid`. A pass needs two different pids, with B's `blocked_by` containing A's pid |

**Design fix (from Codex's point):** if a video is already marked ready when John saves, John's save sets it to ready (patched) by itself. A later Mux step then does nothing, so the race would prove nothing. So in races 2A and 3A, the Mux side marks the upload ready **inside its own script** and then runs the patch. John's save therefore always sees the video as still processing. In 2B and 3B, the Mux script does the same and then holds.

## Fixed identifiers (exact matches only)
- Review `7d73d848-65c3-425a-b291-5f01738e27bd`
- Timeline update 1A `69e6855c-fc3a-425a-8606-08376c6f7fce` (expected to never exist)
- Timeline update 1B `ef2630f7-332b-4287-be1f-aaa0a4795059`
- Uploads (fake, `is_test`, never sent to Mux): `ccrun20261012_r1a`, `ccrun20261012_r1b`, `ccrun20261012_r2a`, `ccrun20261012_r2b`, `ccrun20261012_r3a`, `ccrun20261012_r3b`
- Photo `https://example.com/ccrun20261012-photo.jpg`

## Rules for running
- Each script is **one statement** (one `DO` block or one `SELECT`). If anything fails, that statement rolls back by itself, and no transaction is left open.
- An expected refusal shows as an error. That error is a **pass**. Copy it.
- Order for each race: **Reset** → **Tab A (hold, sleeps 15 s)** → within 15 s, **Tab B (wait)** → while B is still running, **Tab C (watch)** → after both finish, **Check**.
- Send me: B's output, C's output, and the Check output.
- **Missed overlap?** Run that race's **Reset** again, then repeat that race. Every reset puts the full state back (including deleting the 1B update and setting uploads back to processing), so repeating never clashes on IDs.
- **Time limit:** finish within 50 minutes of Step 1. After that, John's edits are blocked by the one-hour rule. If time runs out, run Cleanup, then Step 1 again, and carry on from the race you'd reached.
- If any unexpected error appears, **stop**, run Cleanup, and send it to me. Don't change any rules.

## Watch query (Tab C)
```sql
select a.pid, a.backend_start, a.state, a.wait_event_type, a.wait_event,
       pg_blocking_pids(a.pid) as blocked_by, left(a.query, 70) as query
from pg_stat_activity a
where a.query like '%ccrun20261012 R%' and a.pid <> pg_backend_pid()
order by a.query_start;
```
Pass:
- two rows with **different `pid`s**;
- A shows `wait_event = PgSleep`;
- B shows `wait_event_type = Lock`, with A's pid in `blocked_by`.

Anything else counts as **overlap not proven**.

---

## Preflight (read-only): all values must be 0
```sql
select (select count(*) from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd') review,
       (select count(*) from public.review_updates where id in ('69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')) updates,
       (select count(*) from public.mux_uploads where upload_id in ('ccrun20261012_r1a','ccrun20261012_r1b','ccrun20261012_r2a','ccrun20261012_r2b','ccrun20261012_r3a','ccrun20261012_r3b')) uploads,
       (select count(*) from public.mux_upload_mappings where mux_upload_id in ('ccrun20261012_r1a','ccrun20261012_r1b','ccrun20261012_r2a','ccrun20261012_r2b','ccrun20261012_r3a','ccrun20261012_r3b')) links,
       (select count(*) from public.reviews where user_id='06261a67-ebd7-43db-afe2-c3218e118473' and entity_id='027b88ee-18b9-44d5-8c60-46626d707df4') john_on_subject;
```

## Step 0: baseline counts (read-only, reference only)
```sql
select (select count(*) from public.reviews) reviews, (select count(*) from public.review_updates) updates,
       (select count(*) from public.mux_upload_mappings) links, (select count(*) from public.mux_uploads) uploads,
       (select count(*) from public.media_deletion_candidates) cleanup_queue,
       (select count(*) from public.embedding_trigger_log) embed_log;
```

## Step 1: setup
```sql
DO $s$ BEGIN
  INSERT INTO public.mux_uploads(user_id, upload_id, status, is_test, expires_at) VALUES
   ('06261a67-ebd7-43db-afe2-c3218e118473','ccrun20261012_r1a','waiting',true,now()+interval '1 day'),
   ('06261a67-ebd7-43db-afe2-c3218e118473','ccrun20261012_r1b','waiting',true,now()+interval '1 day'),
   ('06261a67-ebd7-43db-afe2-c3218e118473','ccrun20261012_r2a','waiting',true,now()+interval '1 day'),
   ('06261a67-ebd7-43db-afe2-c3218e118473','ccrun20261012_r2b','waiting',true,now()+interval '1 day'),
   ('06261a67-ebd7-43db-afe2-c3218e118473','ccrun20261012_r3a','waiting',true,now()+interval '1 day'),
   ('06261a67-ebd7-43db-afe2-c3218e118473','ccrun20261012_r3b','waiting',true,now()+interval '1 day');
  INSERT INTO public.reviews(id, user_id, entity_id, title, category, rating, visibility, media)
  VALUES ('7d73d848-65c3-425a-b291-5f01738e27bd','06261a67-ebd7-43db-afe2-c3218e118473',
          '027b88ee-18b9-44d5-8c60-46626d707df4','ccrun20261012','brand',4,'public',
          '[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0}]');
END $s$;
```
**Setup check (read-only)**
```sql
select id, visibility, media, image_url, created_at from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
Expected: one row, `public`, one photo, and the cover is the photo URL.

---

## Race 1A: making the review private holds the lock; a timeline video save waits
**Reset 1A**
```sql
DO $r$ BEGIN /* ccrun20261012 reset 1A */
  DELETE FROM public.review_updates WHERE id IN ('69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059');
  UPDATE public.reviews SET visibility='public',
         media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $r$;
```
**Tab A: hold (as John)**
```sql
DO $h$ BEGIN /* ccrun20261012 R1A hold */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET visibility='private' WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B: wait (as John)**
```sql
DO $w$ BEGIN /* ccrun20261012 R1A wait */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  INSERT INTO public.review_updates(id, review_id, user_id, rating, comment, media) VALUES
   ('69e6855c-fc3a-425a-8606-08376c6f7fce','7d73d848-65c3-425a-b291-5f01738e27bd','06261a67-ebd7-43db-afe2-c3218e118473',3,'ccrun20261012 r1a',
    '[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r1a"}]');
END $w$;
```
**Expected:** A succeeds. B waits, then errors with `review_video_public_only`.

**Check 1A**
```sql
select (select visibility from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd') visibility,
       (select count(*) from public.review_updates where id='69e6855c-fc3a-425a-8606-08376c6f7fce') update_rows,
       (select count(*) from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r1a') links;
```
Pass: `private`, `0`, `0`.

## Race 1B: a timeline video save holds the lock; making the review private waits
**Reset 1B**
```sql
DO $r$ BEGIN /* ccrun20261012 reset 1B */
  DELETE FROM public.review_updates WHERE id IN ('69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059');
  UPDATE public.reviews SET visibility='public',
         media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $r$;
```
**Tab A: hold (as John)**
```sql
DO $h$ BEGIN /* ccrun20261012 R1B hold */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  INSERT INTO public.review_updates(id, review_id, user_id, rating, comment, media) VALUES
   ('ef2630f7-332b-4287-be1f-aaa0a4795059','7d73d848-65c3-425a-b291-5f01738e27bd','06261a67-ebd7-43db-afe2-c3218e118473',3,'ccrun20261012 r1b',
    '[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r1b"}]');
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B: wait (as John)**
```sql
DO $w$ BEGIN /* ccrun20261012 R1B wait */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET visibility='private' WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $w$;
```
**Expected:** A succeeds. B waits, then errors with `review_video_visibility_locked`.

**Check 1B**
```sql
select (select visibility from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd') visibility,
       (select count(*) from public.review_updates where id='ef2630f7-332b-4287-be1f-aaa0a4795059') update_rows,
       (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r1b' and content_id='ef2630f7-332b-4287-be1f-aaa0a4795059') link;
```
Pass: `public`, `1`, `pending`.

---

## Race 2A: John removing the video holds the lock; Mux "ready" waits
**Reset 2A**
```sql
DO $r$ BEGIN /* ccrun20261012 reset 2A */
  UPDATE public.mux_uploads SET status='waiting', asset_id=NULL, playback_id=NULL, duration=NULL WHERE upload_id='ccrun20261012_r2a';
  UPDATE public.reviews SET visibility='public',
         media='[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r2a"},{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":1}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $r$;
```
Reset check (read-only): the link must be `pending`.
```sql
select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r2a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
**Tab A: hold (as John)**
```sql
DO $h$ BEGIN /* ccrun20261012 R2A hold */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B: wait (server: Mux marks ready, then patches)**
```sql
DO $w$ BEGIN /* ccrun20261012 R2A wait */
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ccrun20261012_asset_r2a' WHERE upload_id='ccrun20261012_r2a';
  UPDATE public.mux_uploads SET status='ready', playback_id='ccrun20261012pb2a', duration=10 WHERE upload_id='ccrun20261012_r2a';
  PERFORM public.patch_content_media_from_mux(
    (SELECT id FROM public.mux_upload_mappings WHERE mux_upload_id='ccrun20261012_r2a' AND content_id='7d73d848-65c3-425a-b291-5f01738e27bd'));
END $w$;
```
**Expected:** both succeed. B waits until A finishes, and the patch finds the video removed.

**Check 2A**
```sql
select media, image_url,
  (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r2a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link,
  position('ccrun20261012pb2a' in coalesce(media::text,'') || coalesce(image_url,'')) as stale_poster
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
Pass:
- `media` contains only the photo;
- `image_url` is the photo URL;
- the link is `removed`;
- `stale_poster` = `0`.

## Race 2B: Mux "ready" holds the lock; John removing the video waits
**Reset 2B**
```sql
DO $r$ BEGIN /* ccrun20261012 reset 2B */
  UPDATE public.mux_uploads SET status='waiting', asset_id=NULL, playback_id=NULL, duration=NULL WHERE upload_id='ccrun20261012_r2b';
  UPDATE public.reviews SET visibility='public',
         media='[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r2b"},{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":1}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $r$;
```
Reset check (read-only): the link must be `pending`.
```sql
select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r2b' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
**Tab A: hold (server: Mux marks ready, patches, then holds)**
```sql
DO $h$ BEGIN /* ccrun20261012 R2B hold */
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ccrun20261012_asset_r2b' WHERE upload_id='ccrun20261012_r2b';
  UPDATE public.mux_uploads SET status='ready', playback_id='ccrun20261012pb2b', duration=10 WHERE upload_id='ccrun20261012_r2b';
  PERFORM public.patch_content_media_from_mux(
    (SELECT id FROM public.mux_upload_mappings WHERE mux_upload_id='ccrun20261012_r2b' AND content_id='7d73d848-65c3-425a-b291-5f01738e27bd'));
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B: wait (as John)**
```sql
DO $w$ BEGIN /* ccrun20261012 R2B wait */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $w$;
```
**Expected:** both succeed. B waits until A finishes.

**Check 2B**
```sql
select media, image_url,
  (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r2b' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link,
  position('ccrun20261012pb2b' in coalesce(media::text,'') || coalesce(image_url,'')) as stale_poster
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
Pass:
- only the photo;
- `image_url` is the photo URL;
- the link is `removed`;
- `stale_poster` = `0`.

---

## Race 3A: John moving the video first holds the lock; Mux "ready" waits
**Reset 3A**
```sql
DO $r$ BEGIN /* ccrun20261012 reset 3A */
  UPDATE public.mux_uploads SET status='waiting', asset_id=NULL, playback_id=NULL, duration=NULL WHERE upload_id='ccrun20261012_r3a';
  UPDATE public.reviews SET visibility='public',
         media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0},{"type":"video","provider":"mux","url":"","order":1,"mux_upload_id":"ccrun20261012_r3a"}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $r$;
```
Reset check (read-only): the link must be `pending`, and the cover must be the photo.
```sql
select image_url, (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r3a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
**Tab A: hold (as John)**
```sql
DO $h$ BEGIN /* ccrun20261012 R3A hold */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET media='[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r3a"},{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":1}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B: wait (server: Mux marks ready, then patches)**
```sql
DO $w$ BEGIN /* ccrun20261012 R3A wait */
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ccrun20261012_asset_r3a' WHERE upload_id='ccrun20261012_r3a';
  UPDATE public.mux_uploads SET status='ready', playback_id='ccrun20261012pb3a', duration=10 WHERE upload_id='ccrun20261012_r3a';
  PERFORM public.patch_content_media_from_mux(
    (SELECT id FROM public.mux_upload_mappings WHERE mux_upload_id='ccrun20261012_r3a' AND content_id='7d73d848-65c3-425a-b291-5f01738e27bd'));
END $w$;
```
**Expected:** both succeed. B waits until A finishes, then patches the video, which is now first.

**Check 3A**
```sql
select media->0->>'type' first_item, media->0->>'mux_status' first_status, media->0->>'mux_playback_id' first_playback, image_url,
  (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r3a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
Pass:
- `video`, `ready`, playback `ccrun20261012pb3a`;
- `image_url` = `https://image.mux.com/ccrun20261012pb3a/thumbnail.jpg`;
- the link is `patched`.

## Race 3B: Mux "ready" holds the lock; John moving the video first waits
**Reset 3B**
```sql
DO $r$ BEGIN /* ccrun20261012 reset 3B */
  UPDATE public.mux_uploads SET status='waiting', asset_id=NULL, playback_id=NULL, duration=NULL WHERE upload_id='ccrun20261012_r3b';
  UPDATE public.reviews SET visibility='public',
         media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0},{"type":"video","provider":"mux","url":"","order":1,"mux_upload_id":"ccrun20261012_r3b"}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $r$;
```
Reset check (read-only): the link must be `pending`, and the cover must be the photo.
```sql
select image_url, (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r3b' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
**Tab A: hold (server: Mux marks ready, patches, then holds)**
```sql
DO $h$ BEGIN /* ccrun20261012 R3B hold */
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ccrun20261012_asset_r3b' WHERE upload_id='ccrun20261012_r3b';
  UPDATE public.mux_uploads SET status='ready', playback_id='ccrun20261012pb3b', duration=10 WHERE upload_id='ccrun20261012_r3b';
  PERFORM public.patch_content_media_from_mux(
    (SELECT id FROM public.mux_upload_mappings WHERE mux_upload_id='ccrun20261012_r3b' AND content_id='7d73d848-65c3-425a-b291-5f01738e27bd'));
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B: wait (as John)**
```sql
DO $w$ BEGIN /* ccrun20261012 R3B wait */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET media='[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r3b"},{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":1}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $w$;
```
**Expected:** both succeed. B waits until A finishes. While A holds, the cover is still the photo, because the video is second.

**Check 3B**
```sql
select media->0->>'type' first_item, media->0->>'mux_status' first_status, media->0->>'mux_playback_id' first_playback, image_url,
  (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r3b' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
Pass:
- `video`, `ready`, playback `ccrun20261012pb3b`;
- `image_url` = `https://image.mux.com/ccrun20261012pb3b/thumbnail.jpg`;
- the link is `patched`.

---

## Cleanup: exact IDs only; run it even if testing fails; safe to repeat
```sql
DO $c$ BEGIN /* ccrun20261012 cleanup */
  DELETE FROM public.review_updates WHERE id IN ('69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059');
  DELETE FROM public.reviews WHERE id = '7d73d848-65c3-425a-b291-5f01738e27bd';
  DELETE FROM public.mux_upload_mappings
   WHERE content_id IN ('7d73d848-65c3-425a-b291-5f01738e27bd','69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')
     AND mux_upload_id IN ('ccrun20261012_r1a','ccrun20261012_r1b','ccrun20261012_r2a','ccrun20261012_r2b','ccrun20261012_r3a','ccrun20261012_r3b');
  DELETE FROM public.media_deletion_candidates
   WHERE source_id IN ('7d73d848-65c3-425a-b291-5f01738e27bd','69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059');
  DELETE FROM public.embedding_trigger_log WHERE record_id = '7d73d848-65c3-425a-b291-5f01738e27bd';
  DELETE FROM public.mux_uploads
   WHERE user_id = '06261a67-ebd7-43db-afe2-c3218e118473' AND is_test
     AND upload_id IN ('ccrun20261012_r1a','ccrun20261012_r1b','ccrun20261012_r2a','ccrun20261012_r2b','ccrun20261012_r3a','ccrun20261012_r3b');
END $c$;
```

## Cleanup check (read-only): every value must be 0
```sql
select (select count(*) from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd') review,
       (select count(*) from public.review_updates where id in ('69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')) updates,
       (select count(*) from public.mux_upload_mappings where content_id in ('7d73d848-65c3-425a-b291-5f01738e27bd','69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')) links,
       (select count(*) from public.mux_uploads where upload_id in ('ccrun20261012_r1a','ccrun20261012_r1b','ccrun20261012_r2a','ccrun20261012_r2b','ccrun20261012_r3a','ccrun20261012_r3b')) uploads,
       (select count(*) from public.media_deletion_candidates where source_id in ('7d73d848-65c3-425a-b291-5f01738e27bd','69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')) queue,
       (select count(*) from public.embedding_trigger_log where record_id='7d73d848-65c3-425a-b291-5f01738e27bd') embed_log,
       (select count(*) from public.user_entity_journeys j where to_jsonb(j)::text like '%7d73d848-65c3-425a-b291-5f01738e27bd%') journeys,
       (select count(*) from public.reviews where user_id='06261a67-ebd7-43db-afe2-c3218e118473') john_reviews,
       (select count(*) from public.mux_uploads where user_id='06261a67-ebd7-43db-afe2-c3218e118473') john_uploads;
```
Then run Step 0 again **for reference only**. Other activity may change the totals. Nothing else gets deleted to make them match.

## After you send results
- I'll classify each of the 6 directions as **passed**, **failed** or **overlap not proven**, and confirm cleanup.
- I'll update the Phase 1 verification note and roadmap.
- Then I stop. Video stays off, and Phase 2 needs your separate approval.
- These tests prove database consistency only. Upload and playback get tested in Phase 2 to 4.
