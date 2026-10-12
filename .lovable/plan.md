# Close Phase 3, then Phase 4 — signed-in end-to-end verification (revised)

## Phase 3 check
- Code complete: every review media place uses the shared display rule and the feed player; the Photos tab handles ready videos and posters; review videos send no view events; build and typecheck clean; 1,060 app tests pass.
- Two deliberate differences from the plan wording, no gap:
  - No separate `ReviewVideo` wrapper. The grid's opt-in video mode calls the feed player directly.
  - View counting is off for review videos only, so entity-media videos keep their current counting.
- Planned checks that could not be automated move into Phase 4 as real browser checks: off-screen stop, one-at-a-time with posts, hover pre-load, scroll restore, no playback behind the viewer, failed poster never a cover.
- On approval: mark Phase 3 complete in the task list and the Phase 3 record, listing what moved to Phase 4.

## How Phase 4 runs
- You run the browser steps; I prepare each block, give you the checklist for that block only, run read-only database checks before and after, and record each item as pass / fail / untested. A fail is fixed and re-tested before the next block. Step 0 is the planned code change, but any defect found in testing gets fixed too.
- Accounts:
  - Author: Hana Li.
  - Circle viewer: an account in Hana's Circle (confirmed by a read-only check before the run; if none exists, you pick one to follow her, which is a normal app action).
  - Outsider: John Carter, confirmed not in Hana's Circle.
  - Signed-out window.
- Test subject: the brand entity used before (0 reviews).
- "Review videos" setting: you switch it ON at the start of each session and OFF at the end. I confirm it is OFF afterwards. It is app-wide, so sessions are short and at a quiet time.
- Phase 1 overlap stays unverified and needs its own rollout decision; Phase 4 does not resolve it.

## Run record (kept in the Phase 4 note)
- Every test review, update and post ID; every Mux upload ID, asset ID and playback ID.
- Cleanup deletes only those entries through the app's own Delete. Videos are unlinked and the Mux assets kept, as agreed; they are listed as "retained test assets" for the later Mux-cleanup work.
- Cleanup is judged by those exact IDs (unlinked, entries gone), not by global counts matching.

## Step 0 — code fix
- Timeline viewer coordination: put one shared video manager at the entity page level covering the reviews list, posts and the timeline viewer (including its pop-up), replacing the per-section wrapper so no nested manager isolates players. Automated test: a viewer video and a list video never play at once. Real browser check in Step 3.

## Step 1 — preflight (me, read-only)
- Setting OFF; Mux upload setting ON; test entity has 0 reviews; Circle relationships of the three accounts; photo-cleanup processing and schedule state (read only, not changed).

## Step 2 — composers (deferred Phase 2 checks)
For Review create, Review edit, Timeline create, Timeline edit:
- Public + one video; photo + video; save while processing; Processing to Ready on the open page without reload.
- Save blocked while transferring; cancel during transfer frees the slot.
- Private/Circle greyed out when the review or any update has a video; timeline video refused under a private parent.
- Within the hour: remove and replace a video.
- Switch the setting OFF mid-upload: the upload finishes, new picks are disabled, saved videos stay.

Three separate failure tests (each passes only on its own evidence; otherwise "untested"):
1. **Checks before upload:** 5th item, 2nd video, over 100 MB, a normal 65-second clip are refused before anything uploads.
2. **Real Mux processing failure:** I generate a file in the sandbox that the browser accepts as a video but Mux cannot process (valid header, damaged picture data). Pass: Mux reports failure; the author sees "Upload failed" or "Couldn't process this video"; others see nothing; a new entry cannot be saved with it.
3. **Server-measured too long:** I generate a roughly 70-second clip whose file header gives no length, so the browser can't measure it and lets it through. Pass: Mux measures over 60 seconds, the server marks it "too long", no playback is exposed, others see nothing, the author sees the right message. If the browser still refuses it, this is recorded untested and the Phase 1 database tests remain the only proof. If it gets through the browser, that is also recorded as a known gap in the browser check (the server still catches it).

## Step 3 — playback and display (Phase 3 checks)
On the entity review card, timeline card, profile card, timeline viewer and Photos tab:
- Muted autoplay in view, stops off screen, one at a time (with posts on the same page and with the viewer), hover pre-load, shared mute.
- Full screen: photo-video-photo navigation, opens the tapped item, same second in and back out, no sound or picture behind the viewer, scroll restored.
- Author, Circle viewer, outsider and signed-out: processing and failed videos are seen only by the author, with the right message for inside or after the hour.

## Step 4 — covers and order (agreed rules)
- First item a ready video: its poster. First item a processing video: the next photo, or no cover. First item a failed video: never its poster; the next photo, or no cover. First item a photo: that photo. Reorder, removal and "no items" update the cover. A ready video becoming first after processing updates it.
- I check the database cover against these rules for each test entry, not just against the first item.

## Step 5 — after the one hour
- Natural aging, no timestamp changes: the test entries created at the start of the session are re-checked once more than an hour has passed (the session is planned to run past one hour; otherwise the check runs in the next session). No existing or test timestamps are edited.
- Pass: Edit refused for the review and the update (screen and server); deleting the whole entry still works; a Mux update arriving after the hour still marks the video ready or failed without moving edit times.

## Step 6 — privacy
- A private and a Circle review (photos only): the Circle viewer sees the Circle one; the outsider and signed-out see neither, on cards, the viewer or the Photos tab.
- Sign-out check: Photos tab open as the Circle viewer, sign out, reopen: no Circle media.
- Account-switch check (separate): sign out of the Circle viewer, sign in as John, reopen: no Circle media.

## Step 7 — regressions
- Posts: a post with a video on /create; feed autoplay, view counting and lightbox unchanged. The post's IDs go in the run record.
- Photo-only reviews and updates unchanged.
- Photo cleanup: removing a review photo queues it as before; video posters never queued.
- Old popup and inline timeline form still photo-only.

## Step 8 — database checks after each block (me, read-only)
- Each saved video has one active link; removed and replaced ones marked removed; no upload rows deleted.
- Mux status, playback and duration came from the server; edit times not moved by Mux updates.
- Covers follow the Step 4 rules.

## Step 9 — close
- Cleanup by exact IDs; retained assets listed; setting confirmed OFF.
- Phase 4 record written with pass / fail / untested per item.
- Then your short final acceptance smoke test. The setting is not switched on for everyone until Phase 4 passes.

## Before the signed-in run (this approval)
- Mark Phase 3 complete, build Step 0 with its test, generate the two special test files, and write the block-by-block checklist and the exact read-only queries. Then stop so you can run Block 1 step by step.

## Technical details
- Step 0: move `FeedVideoManagerProvider` to the top of `EntityV4` (covering `ReviewsSection`, the posts tab and both `ReviewTimelineViewer` mounts); remove the provider from `ReviewsSection` and the posts tab to avoid nesting. React context reaches the dialog portal.
- Test files: `ffmpeg` in the sandbox. Failure file: MP4 with a valid moov/ftyp and corrupted mdat payload. No-length file: fragmented MP4 (`-movflags frag_keyframe+empty_moov`), about 70 s; browser reports a non-finite or missing length, and the client check `duration > 60` lets NaN through.
- Queries: `app_config` flags; follows between the three accounts; `mux_upload_mappings` and `mux_uploads` by exact IDs; `reviews.image_url` versus `review_cover_from_media(media)`; `media_deletion_candidates` by exact paths; photo-cleanup config.
