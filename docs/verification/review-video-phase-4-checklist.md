# Review video — Phase 4 checklist (signed-in end-to-end)

Status: PREPARED, not started. `reviews.video_enabled` is OFF. Run one block at a time; each item is recorded **pass / fail / untested**. A fail is fixed and re-tested before the next block.

## Test files (Files → phase4-test-files)
| File | Purpose | Expected |
|---|---|---|
| ok-8s.mp4 | normal video | uploads, Processing → Ready |
| normal-65s.mp4 | known length over 60 s | refused before upload |
| no-length-70s.mp4 | 70 s, header gives no length | allowed with "Length will be checked after upload"; server marks "too long" |
| broken-picture-5s.mp4 | readable header, damaged picture | uploads; Mux processing fails |
| over 100 MB | any large video you have | refused before upload (not generated: too large to store) |

## Accounts
Author Hana Li · connected account (follows Hana; confirmed in Block 1) · outsider John Carter · signed-out window.
Actual access rule: a review is readable only if public or by its author; updates follow their review. "Circle" therefore behaves like "Only me" today.

## Run record (filled in as we go)
| Kind | ID | Mux upload | Mux asset | Playback | Final state |
|---|---|---|---|---|---|
| Review (CHANEL, public) | 0cc9ed7c-8415-4b2c-9fa0-b8f0c7d5ee2d | iHLxrq1e3xp00OcusTaRMoJBulAZ73VyIykqCQ0101He8g | UkBVjFzhnVXgN3m7o00ttxXPUgUUdAt01wYG3iWVKt0284 | b3yGQRsjqlfV7c02Eq2xLCH5jNCZFPw00IRyD6KkyHctM | removed in step 8 (asset retained) |
| Cancelled upload (step 7) | — | l2S02bWJ5QB8028t0151OoTt6y0001cIU9WqS5umzJlCW4Vk | — | yes | never linked (asset retained) |
| Cancelled upload (step 7) | — | GCXLSzbQA01caZ2jGOTW4QjqttmFX701tUC2GE3I4VvIc | — | yes | never linked (asset retained) |
| Review video, replacement (step 8) | 0cc9ed7c-… | 4wduhbzDqgxyrTp9ccE02aligNeENf5KNvNysZI00YiYc | — | yes | linked, slot 1 |

## Block 2 results so far
0 ON pass · 1 pass · 2 pass (Next blocked; exact message untested) · 3 save-while-processing untested (Mux ready in 6 s) · Ready without reload pass · 4 pass · 5 pass · 6 not applicable (no reordering in the app, by product decision) · 7 pass · 8 pass (old link removed, new link active, cover = first item = photo) · 9 pass (update 05b47d37-a4cb-4b5c-842c-bef1a709b8b0; save-while-processing still untested, Mux ready in 3 s) · 10 pass · 11 pass (link s01yCk… removed, qm6EH1… active, slot 1).
Note: saving or editing a timeline update moves the parent review's edit time (`updated_at`); the review's one-hour window is from its creation time, so this is recorded, not a fail.

Retained Mux test assets are kept on purpose for the later Mux-cleanup work.

## Block 1 — preflight (me, read-only)
```sql
select key, value from app_config where key in ('reviews.video_enabled','mux.uploads_enabled','media.deletion_processing_enabled');
select count(*) from reviews where entity_id = '027b88ee-18b9-44d5-8c60-46626d707df4';
select follower_id, following_id from follows
 where follower_id in (<hana>, <connected>, '06261a67-ebd7-43db-afe2-c3218e118473')
   and following_id in (<hana>, <connected>, '06261a67-ebd7-43db-afe2-c3218e118473');
select jobname, schedule, active from cron.job where command ilike '%media-deletion%';
```
(Exact key names and account IDs are confirmed and filled in at the start of Block 1.)

## Block 2 — composers (you; setting ON for the session)
For Review create, Review edit, Timeline create, Timeline edit:
1. Public review + ok-8s.mp4 → Processing chip, then Ready without reload.
2. Photo + video mixed, saved; order kept.
3. Save while Processing → allowed.
4. Save during transfer → blocked with "Wait for your video to finish uploading".
5. Cancel during transfer → slot freed, can pick again.
6. Review with video (or any update with video) → Private/Circle greyed out with reason.
7. Timeline update under a private review → video picking off with reason.
8. Within the hour: remove the video, save; replace it, save.
9. Admin switches setting OFF mid-upload → upload finishes; new picks disabled; saved videos stay and are removable in the hour.

## Block 3 — failure tests
1. 5th item, 2nd video, over-100 MB file, normal-65s.mp4 → each refused before upload.
2. broken-picture-5s.mp4 → Mux failure; author sees failed state; John/signed-out see nothing; a new entry with it can't be saved.
3. no-length-70s.mp4 → note shown; after processing marked "too long"; not playable in the app; others see nothing; author sees the right message. If the browser can't load it: untested.

## Block 4 — playback and display
Places: entity review card, timeline card, profile card, timeline viewer, Photos tab.
Muted autoplay in view · stops off screen · one at a time (with posts on the page, and between the timeline viewer and the list) · hover pre-load · shared mute · full screen photo→video→photo · opens tapped item · same second in and out · nothing playing behind · scroll restored · processing/failed visible only to author with the right message (inside vs after the hour).

## Block 5 — covers and order (me checks each against the rules)
Ready video first → its poster · processing/failed first → next photo or none, never a failed poster · photo first → that photo · reorder, removal, empty, video turning ready → updated.
```sql
select id, image_url, review_cover_from_media(media) as expected, media from reviews where id in (<test ids>);
```

## Block 6 — after the hour (natural aging)
Thread A: latest update past its own hour → Edit refused (screen + server) → delete that update alone → review remains.
Thread B: root review past its hour → Edit refused → delete whole review.
Update is always checked and deleted before any root deletion. A real Mux event after the hour is recorded only if it happens; otherwise untested (Phase 1 DB tests remain evidence).

## Block 7 — privacy (photos only)
"Only me" and "Circle" review. Author: both · connected account: neither (actual rule) · John and signed-out: neither. Places: cards, viewer, Photos tab. Then sign-out-and-reopen; then switch connected account → John and reopen.
Note: "not shown in the app" is screen behaviour; Mux playback links stay public in this phase.

## Block 8 — regressions
Post with video on /create (IDs recorded): feed autoplay, view counting, lightbox unchanged · photo-only reviews unchanged · removing a review photo queues it for cleanup, video posters never queued · old popup and inline timeline form still photo-only.

## After each block (me, read-only)
```sql
select content_type, content_id, mux_upload_id, status, unlinked_at from mux_upload_mappings where content_id in (<test ids>);
select upload_id, status, duration, playback_id from mux_uploads where upload_id in (<test uploads>);
select id, created_at, updated_at, media from reviews where id in (<test ids>);
select id, created_at, media from review_updates where id in (<test update ids>);
select path, status from media_deletion_candidates where path in (<test photo paths>);
```
Pass: one active link per saved video; removed/replaced marked removed; no upload rows deleted; Mux fields from the server; edit times unchanged by Mux updates; covers follow Block 5.

## Close
Delete test entries by exact ID through the app; list retained assets; confirm setting OFF; write pass / fail / untested results. Then the final acceptance smoke test. Phase 1 overlap stays unverified and needs its own rollout decision.

### Block 2 close (2026-10-13 11:46 UTC)
12 pass (Pixi Antioxidant Tonic private review e49314d5-de5d-41aa-801a-3078cade4fa7, text-only update 2bd6e146-a4e3-4766-aa9f-778f195223f3; video picking off) · 13 pass (setting OFF 11:44:30 UTC mid-upload; upload o02cklofk8C77wCteCbFlEyHV1FPOhrOAi73hVpCW5no finished, was saved, then removed 11:46:06; new picks disabled).
Setting confirmed OFF in the database. CHANEL update 05b47d37… now has no active video (3 links, all removed; assets retained).
Carried to Block 4: in step 9 only the review's video played while the update's own video was on screen. One-at-a-time explains one player, but the update video playing when it is the only one in view is still to be shown (Block 4).
Untested: exact "Wait for your video to finish uploading" message; saving while Processing (8 s clip ready in 3–6 s).
Block 2 result: COMPLETE (approved by owner 2026-10-13 11:50 UTC) — pass, with the 2 untested items above; update-video playback carried to Block 4.
