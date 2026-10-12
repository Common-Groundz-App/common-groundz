# Phase 1: real two-connection concurrency tests (John Carter test account)

## Checked before writing this
- John Carter (`06261a67-…8473`) exists and has no reviews, timeline updates or video uploads. Clean.
- This project uses your own external Supabase, so I **can't** sign in a test browser or create a session here. Signing into the preview yourself wouldn't help either: none of your sessions, tokens or cookies reach me, and I don't want them to.
- A browser can't hold a database lock open on purpose anyway. So a signed-in browser couldn't run these tests even if one were available.

## Proposed method: two tabs in your Supabase SQL Editor (no helper, no add-on)
You run the scripts below in **your own** Supabase SQL Editor, in two (or three) tabs. Each tab is its own real database connection, so the race is real and nothing is simulated.

- **No passwords, tokens or cookies.** Nothing is shared in chat. No sign-in happens.
- **No temporary helper function, no new permissions, no grants, no add-on.** Nothing new is created except throwaway test rows.
- **How "acting as John" works, stated plainly:** inside each test transaction the script switches to the normal signed-in role and tells the database that the caller is John's ID. This is how database permission tests are normally done, and the earlier rolled-back tests used it too. It applies only to that one transaction in your editor. It creates no session or token and grants nothing. The normal rules for signed-in users (row access rules, edit window, video rules) all apply, exactly as for the real app. **This is the one point I need your explicit OK on**, because it is technically the database treating the caller as John for those transactions.
- **The Mux side** runs the same way the real Mux server step does: as the server, with no user attached. That's the existing internal update, not a broader bypass.
- **No real Mux uploads or assets:** upload records are marked as tests and use made-up IDs starting with `cc_`.

## Fixed test-record scope
Only these rows, all owned by John:
- 1 review on the existing test entity `027b88ee-…f4df4`, title `CC-TEST`, public.
- Upload records `cc_v1`, `cc_v2`, `cc_v3` (`is_test = true`, made-up, never sent to Mux).
- Any timeline updates and video-link records those create.
- Any photo-cleanup queue entries referring to `https://example.com/cc-*` URLs (fake, so nothing real can be deleted).

## Step 0: counts before (run once)
```sql
select (select count(*) from reviews) reviews, (select count(*) from review_updates) updates,
       (select count(*) from mux_upload_mappings) links, (select count(*) from mux_uploads) uploads,
       (select count(*) from media_deletion_candidates) cleanup_queue;
```

## Step 1: setup (run once)
```sql
insert into mux_uploads(user_id, upload_id, status, is_test, expires_at) values
 ('06261a67-ebd7-43db-afe2-c3218e118473','cc_v1','waiting',true,now()+interval '1 day'),
 ('06261a67-ebd7-43db-afe2-c3218e118473','cc_v2','waiting',true,now()+interval '1 day'),
 ('06261a67-ebd7-43db-afe2-c3218e118473','cc_v3','waiting',true,now()+interval '1 day');
insert into reviews(user_id, entity_id, title, category, rating, visibility, media)
values ('06261a67-ebd7-43db-afe2-c3218e118473','027b88ee-18b9-44d5-8c60-46626d707df4',
        'CC-TEST','brand',4,'public',
        '[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"cc_v2"},
          {"type":"image","url":"https://example.com/cc-a.jpg","order":1}]')
returning id;   -- I'll use this id as <R> in the scripts I send you
```

## The three races
Each race: start tab A, then start tab B within 10 seconds. While B is stuck, run the **watch query** in tab C. It shows B waiting on A's lock, which proves the overlap really happened.

```sql
-- Watch query (tab C)
select pid, state, wait_event_type, wait_event, now()-query_start as waiting_for, left(query,60)
from pg_stat_activity where wait_event_type = 'Lock';
```

Common start of every "as John" tab:
```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"06261a67-ebd7-43db-afe2-c3218e118473","role":"authenticated"}',true);
```

**Race 1 — make review private vs save a timeline update with a video** (run both orders)
- A (as John): `update reviews set visibility='private' where id='<R>'; select pg_sleep(10); commit;`
- B (as John): `insert into review_updates(review_id,user_id,rating,comment,media) values ('<R>','06261a67-…8473',3,'cc','[{"type":"video","provider":"mux","url":"","order":0,"mux_upload_id":"cc_v1"}]'); commit;`
- Expected: B waits, then is refused because the review is now private. Order reversed (B first, holding): A waits, then is refused because a timeline video exists. In neither order does a private review end up with a video. (For the first order, the review's own video is removed during setup so the change to private is allowed.)

**Race 2 — Mux "video ready" vs removing that video**
- Setup: mark `cc_v2` ready with made-up playback ID `CCPB2`.
- A (as John): remove the video (`update reviews set media = '[photo]' …`), `pg_sleep(10)`, commit.
- B (server, no user): `begin; select patch_content_media_from_mux(<link id>); commit;`
- Expected: B waits, then reports the video as removed and does nothing. The video doesn't come back, and the cover is the photo. Also run in the reverse order: patch first, then removal; final state is the same.

**Race 3 — Mux "video ready" vs reordering**
- Setup: media is `[photo, video cc_v3]`, and `cc_v3` is marked ready.
- A (as John): reorder to `[video, photo]`, `pg_sleep(10)`, commit. B (server): patch. Then the reverse order.
- Expected: the cover always matches the final first item (the Mux poster if the video is first, otherwise the photo).

Note: the review is created fresh, so it is within its hour and John's edits are allowed. That way the race is the only thing being tested.

I'll send you each script ready to paste, with `<R>` and the link IDs filled in. You paste the results (just the text output) back to me.

## Step 2: cleanup (always run, even if a race fails)
```sql
delete from review_updates where review_id in (select id from reviews where user_id='06261a67-ebd7-43db-afe2-c3218e118473' and title='CC-TEST');
delete from reviews where user_id='06261a67-ebd7-43db-afe2-c3218e118473' and title='CC-TEST';
delete from mux_upload_mappings where mux_upload_id like 'cc\_v_' escape '\';
delete from media_deletion_candidates where object_path like '%cc-%' and created_at > now() - interval '1 day';
delete from mux_uploads where user_id='06261a67-ebd7-43db-afe2-c3218e118473' and upload_id like 'cc\_v_' escape '\' and is_test;
```
Then run Step 0 again; the counts must match the earlier ones exactly. I'll also check John has 0 reviews, updates and uploads. (I'll confirm the cleanup-queue column name before sending; the photos are fake example.com links, so nothing real is queued.)

## After the results
I'll update the Phase 1 verification note and roadmap, listing each race as passed, failed or blocked, then stop. Video stays off and Phase 2 stays on hold.

## If you'd rather not use the "acting as John" step
The only other real-overlap option is the `dblink` add-on, which you've ruled out. Without either, the races stay **unverified**, and I'd report Phase 1 as complete except for those three tests.
