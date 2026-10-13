# Phase 4 — Block 1 approved, Block 2 prepared

## Block 1 — closed (pass)
- Review videos OFF, Mux uploads ON (live), new review page ON, CHANEL entity has 0 reviews/updates.
- Outsider confirmed: **Anitha Sr** (anithasr@email.com, `c82c9b24-d832-460b-9a3d-97299e92f4ed`) — 0 followers, 0 following, no follow either way with Hana (checked just now; an earlier read at 08:16 showed her following Hana, which no longer exists). She has 1 existing review, not on CHANEL; it is not touched.
- Connected: Linda Williams (`ff397c4b-…502d3`, follows Hana). Author: Hana Li (`abfcbf43-…8794`).
- No follow relationships changed.
- Note: the task list file can't be edited in this review mode; it will be updated with "Block 1 passed, outsider = Anitha" as the first step once you approve.

## Block 2 — composers (you run; nothing starts until you say "ready")

**Before you start (me):** read-only snapshot of CHANEL reviews and Hana's upload links, so every new ID is recorded.

**Setup (you):** signed in as Hana, test files from Files → phase4-test-files downloaded. Then Admin → Feature flags → Reviews → switch **Review videos ON**. Tell me the time you switched it.

Do the steps in order; after each, tell me pass / fail and anything odd. I check the database after steps 1, 4, 8 and 11.

### A. Review create (CHANEL page → Write review)
1. Public review, add **ok-8s.mp4** only. While it transfers, a progress tile shows.
2. While still transferring, press Save → must be blocked with "Wait for your video to finish uploading".
3. Remove nothing; wait until the tile shows Processing. Save → allowed. Open the review: author sees "Processing", then Ready plays **without reloading** (wait up to ~2 min).
4. On the privacy step of that same flow (or via Edit): Private / Circle must be greyed out with a reason.

### B. Review edit (same review, within its first hour)
5. Edit → add one photo after the video, save → order kept (video, photo); cover = the video's poster.
6. Edit → drag photo first, save → cover becomes the photo.
7. Edit → pick a new video, then cancel it mid-transfer → slot frees, you can pick again; cancel again and save without it → saved video unchanged.
8. Edit → remove the video, save; Edit → add ok-8s.mp4 again, save (replace within the hour).

### C. Timeline create (same review → Add update)
9. Update with **ok-8s.mp4** + one photo; try Save during transfer (blocked), then save once Processing; Ready appears without reload.
10. Return to the review's Edit → Private / Circle still greyed out (because an update has a video).

### D. Timeline edit (that update, within its hour)
11. Edit the update → remove video, save; add it again, save.

### E. Private-parent rule
12. Make a **separate photo-only review as "Only me"** on another entity you choose (tell me which); Add update → video picking is off with a reason. Save a text-only update.

### F. Switch OFF mid-upload
13. Start a new Edit on the CHANEL review update or a new update, pick ok-8s.mp4, and while it transfers I ask you to switch Review videos **OFF** (from a second tab). Expected: that upload finishes and can be saved; afterwards new picks are disabled; saved videos still show and can be removed within the hour.

**End of Block 2 (you):** confirm Review videos is OFF (I confirm in the database). Do not delete anything yet — these entries are reused in Blocks 4–6.

## After Block 2 (me, read-only)
- One active upload link per saved video; removed/replaced ones marked removed; no upload rows deleted.
- Mux status, playback and length set by the server; edit times not moved by Mux.
- Cover matches the media-order rule.
- All IDs added to the run record.

## Technical details
- Snapshot/after queries: `reviews`/`review_updates` by `user_id = Hana` and `entity_id = CHANEL`; `mux_upload_mappings` by those content IDs; `mux_uploads` by mapped upload IDs; `image_url` vs `review_cover_from_media(media)`; `app_config` `reviews.video_enabled`.
