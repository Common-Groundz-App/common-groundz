# Close Phase 3, then Phase 4 — signed-in end-to-end verification

## Phase 3 check
- Code complete: every review media place uses the shared display rule and the feed player; the Photos tab handles ready videos and posters; review videos send no view events; the build and typecheck are clean; 1,060 app tests pass.
- Two deliberate differences from the plan wording, no gap:
  - No separate `ReviewVideo` wrapper. The grid's opt-in video mode calls the feed player directly. Same behaviour, one less file.
  - View counting is off for review videos only, not "on for posts only", so entity-media videos keep their current counting.
- Planned checks that could not be automated, moved into Phase 4 as real browser checks (not reopening Phase 3): off-screen stop, one-at-a-time with posts, hover pre-load, scroll restore, and "a failed video's poster never becomes a cover".
- On approval: mark Phase 3 complete in the task list and the Phase 3 record, with those items listed as carried into Phase 4.

## Phase 4 — how it runs
- This environment cannot sign in to your app, so you run the browser steps. I prepare everything, check the database before and after each block (read-only), and fix anything that fails.
- Accounts: your normal test account (Hana Li) as author, John Carter as "someone else", plus a signed-out window. Test subject: the brand entity used before (0 reviews).
- Real Mux uploads are used (small clips). Kept Mux videos are not deleted (deletion is later work).
- "Review videos" setting: ON only for the test window, switched OFF again right after each session. It is a single app-wide switch, so real users could add videos during that window. Run sessions at a quiet time and keep them short.
- I write every test review/update ID into a run record; cleanup deletes only those through the app's own Delete, then I confirm counts.

## Step 0 — code fix before testing
- Timeline viewer coordination: the viewer opened from the entity header is outside the one-at-a-time video manager. Wrap it in the same manager as the page so its videos pause the page's videos and vice versa. Add an automated test. This is the only planned code change.

## Step 1 — preflight (me, read-only)
- Setting is OFF; Mux upload setting is ON; test entity has 0 reviews; baseline counts of review links, Mux uploads, photo-cleanup queue, post videos.

## Step 2 — composers (deferred Phase 2 checks)
For each of Review create, Review edit, Timeline create, Timeline edit:
- Public + one video; photo + video mixed; save while processing; Processing becomes Ready on the open page without reload.
- Limits: a 5th item, a 2nd video, over 100 MB, over 60 seconds are refused with clear messages.
- Save blocked while transferring; cancel during transfer frees the slot.
- Private/Circle greyed out when the review or any update has a video; timeline video refused under a private parent.
- Within the hour: remove and replace a video. After the hour: everything locked; delete still works.
- Switch the setting OFF mid-upload: the upload finishes, new picks are disabled, saved videos stay.
- Failed video: a broken file (renamed non-video) shows "Upload failed" and blocks saving a new entry; a too-long clip (about 65 seconds) ends as "too long" after processing.

## Step 3 — playback and display (Phase 3 checks)
On the entity review card, timeline card, profile card, timeline viewer and Photos tab:
- Muted autoplay in view, stops off screen, one at a time (including with posts on the same page), hover pre-load, shared mute.
- Full screen: photo-video-photo navigation, opens the tapped item, same second in and back out, no sound or picture behind the viewer, scroll position restored.
- Author vs John vs signed-out: processing and failed videos are seen only by the author, with the right message for inside or after the hour.
- Order and covers: the first item drives the cover; reordering, removing and video-first all update the cover; a failed video's poster never appears as a cover.
- Timeline viewer coordination fix from Step 0.

## Step 4 — privacy
- A private review and a Circle review (photos only) never appear to John or signed-out visitors on cards, the viewer or the Photos tab.
- Reopening the Photos tab after signing out shows no previously visible Circle media.

## Step 5 — regressions
- Posts: create a post with a video on /create; feed autoplay, view counting and lightbox unchanged.
- Photo-only reviews and updates look and behave as before.
- Photo cleanup: removing a review photo queues it as before; video posters are never queued.
- Old popup and inline timeline form remain photo-only (rollback path).

## Step 6 — database checks after each block (me, read-only)
- Every saved video has exactly one active link; removed and replaced ones are marked removed; no upload rows deleted.
- Mux status and playback came from the server; the edit-hour times are not moved by Mux updates.
- Covers match the first item.

## Step 7 — close
- Cleanup by exact IDs; setting confirmed OFF.
- Results written to a Phase 4 record. Every failure is fixed and re-tested before closing.
- Phase 1 overlap stays recorded as unverified.
- Then only your short final acceptance smoke test remains before Review video is complete. The setting is not switched on for everyone until Phase 4 passes.

## Technical details
- Step 0: wrap `ReviewTimelineViewer` usage in `EntityV4` (and the reviews list) under one `FeedVideoManagerProvider` at the entity page level instead of the per-section wrapper in `ReviewsSection`, so all review and post videos on the entity page share one manager. Test: two `FeedVideo` slots across the viewer and the list, only one active.
- Preflight and post-block queries: `app_config` (`reviews.video_enabled`, Mux upload flag), `mux_upload_mappings` by content id, `mux_uploads` by upload id, `media_deletion_candidates` counts, `reviews.image_url` vs `media[0]`.
- I'll provide a printable checklist with expected results per step and the exact queries I run between blocks.
