# Close Phase 3, prepare Phase 4 (signed-in end-to-end verification)

This approval covers only: closing Phase 3, the Step 0 code fixes, test files, and the block-by-block checklist. No real uploads or browser testing start until you begin the session. "Review videos" stays OFF.

## Phase 3 check
- Code complete: every review media place uses the shared display rule and the feed player; Photos tab handles ready videos; review videos send no view events; build and typecheck clean; 1,060 app tests pass.
- Deliberate differences from the plan wording: no separate `ReviewVideo` wrapper (the grid calls the feed player directly); view counting is off for review videos only, so entity-media videos keep theirs.
- Moved into Phase 4 as real browser checks: off-screen stop, one-at-a-time with posts, hover pre-load, scroll restore, no playback behind the viewer, failed poster never a cover.
- Action: mark Phase 3 complete in the task list and its record, listing those items.

## Findings from read-only checks
- **Circle access, actual rule:** the database lets a review be read only if it is public or by its author; timeline updates follow their review. There is no Circle access rule, so a "Circle" review is today visible only to its author, same as "Only me". Phase 4 tests that actual rule. Whether Circle members should see Circle reviews is a separate product decision, outside Review video.
- **Unknown video length:** the check before upload compares the browser-reported length with 60 seconds. When the browser cannot read a length, the comparison fails silently and the video gets through by accident.

## Step 0 — code fixes (before testing)
1. **One video manager per entity page.** Move it to the top of the entity page so the reviews list, posts tab and timeline viewer (including its pop-up) share it; remove the inner ones so no nested manager isolates players. Automated test: a viewer video and a list video never play at once.
2. **Unknown-length rule for review videos (explicit policy):** a known length over 60 seconds is still refused before upload. An unknown length is allowed on purpose: the tile says "Length will be checked after upload", and the server's own measurement decides (over 60 becomes "too long"). Tests cover known over 60, unknown, and under 60. Posts keep their current check; their same gap is noted in the record for a later decision.
3. Then the full test suite, typecheck and build.
- Other defects found during Phase 4 get fixed too; Step 0 is just the planned part.

## How the run works
- You run browser steps one block at a time; I give you that block's checklist, run read-only database checks before and after, and record each item as **pass / fail / untested**. A fail is fixed and re-tested before the next block.
- Accounts: author Hana Li; a second account connected to Hana (follows her); outsider John Carter (not connected); a signed-out window. Connections are confirmed read-only before the privacy block.
- Test subject: the brand entity used before (0 reviews).
- You switch "Review videos" ON at the start of a session and OFF at the end; I confirm it is OFF. It is app-wide, so sessions are short and at a quiet time.
- Run record: every test review, update and post ID, plus every Mux upload, asset and playback ID. Cleanup deletes only those through the app's Delete; videos are unlinked and the Mux assets kept, listed as retained test assets for the later Mux-cleanup work. Cleanup is judged by those exact IDs, not global counts.
- Wording: "not shown in the app" means screen behaviour only. Mux playback stays public in this phase, so a known playback link could still be opened directly; private playback is later work.
- Phase 1 overlap stays unverified and needs its own rollout decision.

## Blocks
**Block 1 — preflight (me, read-only):** setting OFF; Mux uploads ON; test entity empty; account connections; photo-cleanup processing and schedule state (read only).

**Block 2 — composers (deferred Phase 2 checks)**, for Review create, Review edit, Timeline create, Timeline edit: public + one video; photo + video; save while processing; Processing to Ready without reload; save blocked while transferring; cancel during transfer frees the slot; Private/Circle greyed out when the review or any update has a video; timeline video refused under a private parent; within the hour remove and replace; setting switched OFF mid-upload (upload finishes, new picks disabled, saved videos stay).

**Block 3 — three separate failure tests** (each passes only on its own evidence):
1. Checks before upload: a 5th item, a 2nd video, over 100 MB and a normal 65-second clip are refused before anything uploads.
2. Real Mux processing failure: a file I generate that the browser accepts but Mux cannot process. Pass: Mux reports failure; author sees the failed state; others see nothing; a new entry can't be saved with it.
3. Server-measured too long: a roughly 70-second clip I generate whose header gives no length. Pass: tile shows "Length will be checked after upload"; Mux measures over 60; server marks it "too long"; it is not playable in the app; others see nothing; the author sees the right message. If the browser can't load it at all: untested, with the Phase 1 database tests as the remaining proof.

**Block 4 — playback and display** on the entity review card, timeline card, profile card, timeline viewer and Photos tab: muted autoplay in view, off-screen stop, one at a time (with posts and with the viewer), hover pre-load, shared mute; full screen photo-video-photo, opens the tapped item, same second in and out, nothing playing behind it, scroll restored; author / connected account / outsider / signed-out see processing and failed videos only for the author, with the right message.

**Block 5 — covers and order:** ready video first gives its poster; processing or failed video first gives the next photo or no cover, never a failed poster; photo first gives that photo; reorder, removal, empty, and a video turning ready all update it. I check each cover against these rules, not just against the first item.

**Block 6 — after the hour (natural aging, no timestamp changes).** Entries made at the start are re-checked after their own hour (later in the session or next session). Separate test threads:
- Thread A: after the latest update's own hour, its Edit is refused on screen and by the server; then delete that update alone and confirm it is gone while the review remains.
- Thread B (or A afterwards): after the root review's own hour, its Edit is refused; then delete the whole review and timeline.
- The update is always checked and deleted before any root deletion, so it is never removed as a side effect.
- A real Mux event arriving after an hour is recorded only if it actually happens; otherwise untested in the browser, with the Phase 1 database tests as evidence. No webhook is delayed.

**Block 7 — privacy** (photos only): an "Only me" and a "Circle" review. Author sees both. Connected account: denied "Only me", and under today's rule also denied "Circle" (recorded as the actual rule). Outsider and signed-out: neither. Places: cards, viewer, Photos tab. Then separately: sign-out and reopen; and switching from the connected account to John and reopening.

**Block 8 — regressions:** a post with a video on /create (IDs recorded): feed autoplay, view counting and lightbox unchanged; photo-only reviews and updates unchanged; removing a review photo still queues it for photo cleanup, video posters never queued; old popup and inline timeline form still photo-only.

**After each block (me, read-only):** one active link per saved video; removed and replaced ones marked removed; no upload rows deleted; Mux status, playback and length from the server; edit times not moved by Mux updates; covers follow Block 5 rules.

**Close:** cleanup by exact IDs, retained assets listed, setting confirmed OFF, Phase 4 record with pass / fail / untested. Then your short final acceptance smoke test. Switching videos on for everyone needs Phase 4 passing, your acceptance, and the separate Phase 1 overlap decision.

## Technical details
- Manager: `FeedVideoManagerProvider` at the top of `EntityV4`, removed from `ReviewsSection` and the posts tab; context reaches the dialog portal.
- Unknown length: in the review composer path, treat a non-finite `duration` as "unknown" (allowed, tile note) instead of relying on `NaN > 60` being false; posts' `validateMediaFile` unchanged.
- Test files via `ffmpeg` in the sandbox: failure file = valid MP4 header with damaged picture data; no-length file = fragmented MP4 (`frag_keyframe+empty_moov`), about 70 s.
- Access rule: `reviews` read policy `visibility = 'public' OR user_id = auth.uid()`; `review_updates` follow the parent.
- Queries: `app_config` flags; `follows` between the accounts; `mux_upload_mappings` / `mux_uploads` by exact IDs; `reviews.image_url` versus `review_cover_from_media(media)`; `media_deletion_candidates` by exact paths; photo-cleanup config.
