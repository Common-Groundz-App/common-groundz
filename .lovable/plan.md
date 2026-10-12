# Phase 1: concurrency tests, complete SQL Editor scripts (John Carter)

Video uploads stay off, and Phase 2 stays on hold until you've seen these results.

## Checked against the live database
- **John Carter** `06261a67-ebd7-43db-afe2-c3218e118473`: profile exists, with 0 reviews, 0 timeline updates and 0 uploads.
- **Test subject** `027b88ee-18b9-44d5-8c60-46626d707df4`: type `brand`, 0 reviews.
- **Upload status values:** `waiting, asset_created, ready, errored, cancelled`.
- **`patch_content_media_from_mux(p_mapping_id uuid) returns text`.** Signed-in users can't call it. For reviews it hands off to `patch_review_media_from_mux`, which:
  - refuses unless `is_trusted_server_context()` is true. That is true only when there is no signed-in user and the role is empty or `service_role`. The SQL Editor runs as `postgres` with no user attached, so it counts as the server. This is the same context the Mux webhook uses;
  - locks the review or update row first, then the link;
  - answers `patched`, `noop_removed`, `noop_already_patched`, `noop_orphaned`, `noop_errored` or `noop_not_ready`.
- **Link statuses used here:** `pending`, `patched`, `removed`.
- **Timeline inserts:** signed-in users may add updates only to their own reviews. They have no direct update permission on timeline updates.
- **Review triggers:** edit window, `zz_review_media_mux_before/after` (video rules, locks, links), photo-cleanup queueing and embedding.
- **Side effects of creating the review:**
  - one `embedding_trigger_log` row and one small background AI embedding request (cleaned up; the request is harmless once the review is gone);
  - the review appears publicly on that brand's page for the length of the test.

## Fixed run identifiers (used everywhere, exact matches only)
- Run tag: `ccrun20261012`
- Review: `7d73d848-65c3-425a-b291-5f01738e27bd`
- Timeline update for race 1A (expected to be refused, so it should never exist): `69e6855c-fc3a-425a-8606-08376c6f7fce`
- Timeline update for race 1B: `ef2630f7-332b-4287-be1f-aaa0a4795059`
- Uploads (made-up, `is_test = true`, never sent to Mux): `ccrun20261012_r1a`, `ccrun20261012_r1b`, `ccrun20261012_r2a`, `ccrun20261012_r2b`, `ccrun20261012_r3a`, `ccrun20261012_r3b`
- Photo: `https://example.com/ccrun20261012-photo.jpg`. It's fake and isn't a storage path, so photo cleanup never queues it.

Every script is a single statement (one `DO` block or one `SELECT`). If anything inside fails, the whole statement is rolled back automatically, so no transaction is ever left open. The expected refusals show up as an error message. That error is the result to paste back to me.

**Time limit:** finish all races within 50 minutes of the setup. John's own edits are only allowed in the review's first hour. If you run out of time, run cleanup, then setup again.

## How to run each race
- **Tab A** runs the "hold" script. It makes its change, then waits 15 seconds before finishing.
- Within those 15 seconds, run the "wait" script in **Tab B**.
- While B is stuck, run the **watch query** in **Tab C**.
- When both finish, run that race's **check query**.
- Paste me the outputs of B, C and the check query.

**Watch query (Tab C): proves two separate connections and real lock waiting**
```sql
select a.pid, a.backend_start, a.state, a.wait_event_type, a.wait_event,
       pg_blocking_pids(a.pid) as blocked_by, left(a.query, 60) as query
from pg_stat_activity a
where a.query like '%ccrun20261012%' and a.pid <> pg_backend_pid()
order by a.query_start;
```
For a pass, it must show **two rows with different `pid`s**:
- Tab A: `wait_event = PgSleep`;
- Tab B: `wait_event_type = Lock`, and `blocked_by` contains Tab A's pid.

If both rows show the same pid, or no row shows `Lock`, that race counts as "overlap not proven". In that case run it again.

---

## Step 0: counts before (read-only, for reference only)
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
Check: `select id, visibility, media, image_url, created_at from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';`

---

## Race 1A: John makes the review private while saving a timeline video
Reset: none needed; the review is public with a photo only.

**Tab A (hold, as John)**
```sql
DO $h$ BEGIN /* ccrun20261012 R1A hold */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET visibility='private' WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B (wait, as John)**
```sql
DO $w$ BEGIN /* ccrun20261012 R1A wait */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  INSERT INTO public.review_updates(id, review_id, user_id, rating, comment, media) VALUES
   ('69e6855c-fc3a-425a-8606-08376c6f7fce','7d73d848-65c3-425a-b291-5f01738e27bd','06261a67-ebd7-43db-afe2-c3218e118473',3,'ccrun20261012 r1a',
    '[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r1a"}]');
END $w$;
```
Expected: A succeeds. B waits, then errors with `review_video_public_only`.

**Check 1A**
```sql
select (select visibility from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd') visibility,
       (select count(*) from public.review_updates where id='69e6855c-fc3a-425a-8606-08376c6f7fce') update_rows,
       (select count(*) from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r1a') links;
```
Pass: `private`, 0, 0.

## Race 1B: John saves a timeline video while making the review private
**Reset 1B (server)**
```sql
DO $r$ BEGIN UPDATE public.reviews SET visibility='public' WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd'; END $r$;
```
**Tab A (hold, as John)**
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
**Tab B (wait, as John)**
```sql
DO $w$ BEGIN /* ccrun20261012 R1B wait */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET visibility='private' WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $w$;
```
Expected: A succeeds. B waits, then errors with `review_video_visibility_locked`.

**Check 1B**
```sql
select (select visibility from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd') visibility,
       (select count(*) from public.review_updates where id='ef2630f7-332b-4287-be1f-aaa0a4795059') update_rows,
       (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r1b' and content_id='ef2630f7-332b-4287-be1f-aaa0a4795059') link;
```
Pass: `public`, 1, `pending`.

---

## Race 2A: John removes the video while Mux reports it ready
**Reset 2A (server):** attach the video while it's still processing, then mark it ready without patching.
```sql
DO $r$ BEGIN
  UPDATE public.reviews SET media='[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r2a"},{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":1}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ccrun20261012_asset_r2a' WHERE upload_id='ccrun20261012_r2a';
  UPDATE public.mux_uploads SET status='ready', playback_id='ccrun20261012pb2a', duration=10 WHERE upload_id='ccrun20261012_r2a';
END $r$;
```
**Tab A (hold, as John)**
```sql
DO $h$ BEGIN /* ccrun20261012 R2A hold */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B (wait, server)**
```sql
select /* ccrun20261012 R2A wait */ public.patch_content_media_from_mux(
  (select id from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r2a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd')) as result;
```
Expected: B waits, then returns `noop_removed`.

**Check 2A**
```sql
select media, image_url,
  (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r2a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
Pass: media holds only the photo, the cover is the photo URL, the link is `removed`.

## Race 2B: Mux reports ready while John removes the video
**Reset 2B (server)**
```sql
DO $r$ BEGIN
  UPDATE public.reviews SET media='[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r2b"},{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":1}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ccrun20261012_asset_r2b' WHERE upload_id='ccrun20261012_r2b';
  UPDATE public.mux_uploads SET status='ready', playback_id='ccrun20261012pb2b', duration=10 WHERE upload_id='ccrun20261012_r2b';
END $r$;
```
**Tab A (hold, server)**
```sql
DO $h$ BEGIN /* ccrun20261012 R2B hold */
  PERFORM public.patch_content_media_from_mux(
    (select id from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r2b' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd'));
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B (wait, as John)**
```sql
DO $w$ BEGIN /* ccrun20261012 R2B wait */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
END $w$;
```
Expected: B waits, then succeeds.

**Check 2B**: same as Check 2A with `ccrun20261012_r2b`. Pass: only the photo, the cover is the photo, the link is `removed`, and no `ccrun20261012pb2b` appears anywhere in `media` or `image_url`.

---

## Race 3A: John reorders while Mux reports ready
**Reset 3A (server)**
```sql
DO $r$ BEGIN
  UPDATE public.reviews SET media='[{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":0},{"type":"video","provider":"mux","url":"","order":1,"mux_upload_id":"ccrun20261012_r3a"}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  UPDATE public.mux_uploads SET status='asset_created', asset_id='ccrun20261012_asset_r3a' WHERE upload_id='ccrun20261012_r3a';
  UPDATE public.mux_uploads SET status='ready', playback_id='ccrun20261012pb3a', duration=10 WHERE upload_id='ccrun20261012_r3a';
END $r$;
```
**Tab A (hold, as John)**
```sql
DO $h$ BEGIN /* ccrun20261012 R3A hold */
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
  UPDATE public.reviews SET media='[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"ccrun20261012_r3a"},{"type":"image","url":"https://example.com/ccrun20261012-photo.jpg","order":1}]'
   WHERE id='7d73d848-65c3-425a-b291-5f01738e27bd';
  PERFORM pg_sleep(15);
END $h$;
```
**Tab B (wait, server)**
```sql
select /* ccrun20261012 R3A wait */ public.patch_content_media_from_mux(
  (select id from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r3a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd')) as result;
```
**Check 3A**
```sql
select media->0->>'type' first_item, media->0->>'mux_playback_id' first_playback, image_url,
  (select status from public.mux_upload_mappings where mux_upload_id='ccrun20261012_r3a' and content_id='7d73d848-65c3-425a-b291-5f01738e27bd') link
from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd';
```
Pass:
- the first item is `video` with playback `ccrun20261012pb3a`;
- the cover is `https://image.mux.com/ccrun20261012pb3a/thumbnail.jpg`;
- the link is `patched`.

B returns either `patched` or `noop_already_patched`. Both are fine.

## Race 3B: Mux reports ready while John reorders
**Reset 3B (server):** same as Reset 3A, using `ccrun20261012_r3b`, `ccrun20261012_asset_r3b` and `ccrun20261012pb3b`.
**Tab A (hold, server):** same as the 2B hold, using `ccrun20261012_r3b`, and the comment `/* ccrun20261012 R3B hold */`.
**Tab B (wait, as John):** same as the 3A hold without `pg_sleep`, using `ccrun20261012_r3b`, and the comment `/* ccrun20261012 R3B wait */`.
**Check 3B:** same as Check 3A with `r3b` / `pb3b`. Pass: the first item is the video, and the cover is the `ccrun20261012pb3b` poster.

When I hand these over, the 3B scripts will be written out in full, like the others. Only the names change.

---

## Step 2: cleanup (exact IDs only; safe to run more than once)
```sql
DO $c$ BEGIN
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

**Cleanup check (read-only)**: every value must be 0.
```sql
select (select count(*) from public.reviews where id='7d73d848-65c3-425a-b291-5f01738e27bd') review,
       (select count(*) from public.review_updates where id in ('69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')) updates,
       (select count(*) from public.mux_upload_mappings where content_id in ('7d73d848-65c3-425a-b291-5f01738e27bd','69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')) links,
       (select count(*) from public.mux_uploads where upload_id in ('ccrun20261012_r1a','ccrun20261012_r1b','ccrun20261012_r2a','ccrun20261012_r2b','ccrun20261012_r3a','ccrun20261012_r3b')) uploads,
       (select count(*) from public.media_deletion_candidates where source_id in ('7d73d848-65c3-425a-b291-5f01738e27bd','69e6855c-fc3a-425a-8606-08376c6f7fce','ef2630f7-332b-4287-be1f-aaa0a4795059')) queue,
       (select count(*) from public.embedding_trigger_log where record_id='7d73d848-65c3-425a-b291-5f01738e27bd') embed_log,
       (select count(*) from public.reviews where user_id='06261a67-ebd7-43db-afe2-c3218e118473') john_reviews;
```
After that, run Step 0 again for reference. If other people used the app in the meantime, the counts may differ. That's expected, and nothing else gets changed to make them match.

## After you paste results
I'll update the Phase 1 verification note and roadmap, listing each race as passed, failed, or "overlap not proven", then stop.

## Technical notes
- Before giving you the final copy, I'll confirm that a role switch inside a `DO` block is allowed in the SQL Editor. The earlier rolled-back tests used exactly this pattern on this database.
- I'll also confirm whether the review-update insert trigger writes any other rows (for example a journey). Cleanup gets extended to those exact IDs if needed.
- If the SQL Editor ever reuses one connection for two tabs, Tab B would run only after Tab A finishes. The watch query would then show one row and no `Lock`, so this can't be mistaken for a pass.
