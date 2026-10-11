# Review video (Mux) — revised plan

Direction approved: reuse the existing post video system, no second system. This revision adds the agreed rules and the lifecycle details.

## Confirmed facts

- Home feed has no review cards. It shows posts whose type is "review" — those already support video. Removed from scope.
- No review notifications exist. Nothing in the database creates a notification for a review or timeline update, and the notification opener treats "review" as unsupported. Notifications are out of scope.
- Posts already use: 4 items max, 1 video max, 100 MB, 60 seconds. Reviews reuse these exact limits.
- Post videos use public playback links (anyone with the link can watch). Reviews get the same in this phase; private and Circle-only review videos are hidden by the app, not by Mux. Recorded as a known limitation.

## Rules

- Applies only to: new Review page (create + edit), new Timeline page (create + edit), and the places that show review media.
- Old popup and old inline timeline form stay frozen and photo-only.
- Max 4 items, max 1 video per review or update, mix allowed (1 video + 3 photos). Enforced on screen and on the server.
- Removing a saved video: it disappears from the review, its link is marked unlinked, the Mux video is NOT deleted. Mux cleanup is a later, separate phase.
- Existing unlinked Mux videos (unposted /create uploads, deleted posts) are left alone and listed for that later phase.

## Lifecycle — what happens in each case

| Case | Result |
|---|---|
| Upload finishes, user cancels | Nothing saved; video stays unlinked in Mux (later cleanup) |
| Upload finishes, Save fails | Review not saved; draft and video kept on screen so Save can be retried |
| Video removed or replaced before Save | Never linked; unlinked in Mux |
| Still processing when Save pressed | Save allowed (same as posts); shows "Processing" until ready |
| Save succeeds, linking unclear | Not possible: linking happens inside the same save on the server (see below) |
| Edit save fails after media changes | Nothing changes; old video stays linked and shown |
| Review or update deleted | Its links marked unlinked; video kept |

Improvement over posts: posts link videos in a second step after saving, so a failed second step can leave a video stuck on "Processing". For reviews, the server links videos in the same save, so a saved review always has its video linked. Posts are not changed.

## Phases

1. Server foundation (no screen changes)
   - Link videos automatically when a review or update is saved or edited, only if the uploader is the author. Nobody can attach someone else's upload.
   - "Video ready" step updates the review or update without counting as an author edit: no change to edit window, created/updated times, or stored text.
   - Safe with repeated, late or out-of-order Mux messages; ignores removed videos and deleted content.
   - Server limit: 4 items, 1 video.
   - Tests for all of the above, and posts unchanged.
2. Composers: turn video on in the new Review and Timeline pages (create + edit) with the same upload stages, poster, "Processing" chip and compatibility hint as /create. Save button follows the table above.
3. Display: one shared video player taken from the feed (streaming, processing/error poster, autoplay in view, one video playing at a time, hover pre-load, shared mute, lightbox resume at same second). Post-only view tracking stays with posts. Used on profile review cards, entity page review and timeline cards, the read-only timeline viewer, and the lightbox.
4. Integration tests, browser checks, then your signed-in checklist.

Before phase 3 code changes, a final check of every place review media is drawn, including cover images.

## Not touched

Old popups and inline forms, rollout switch, posts behaviour, photo cleanup (it only handles photo files in our storage; Mux posters live on Mux, so it can never delete them), existing unlinked Mux videos, notifications.

## Technical details

- Trigger on `reviews` / `review_updates` (insert/update of `media`) upserts `mux_upload_mappings` (`content_type` 'review' | 'review_update') for items with `mux_upload_id`, checking `mux_uploads.user_id = NEW.user_id`; removed items set mapping status 'unlinked'; delete marks all unlinked. Conflicts (upload mapped elsewhere) reject the save.
- `patch_content_media_from_mux` extended with review branches; it sets only the slot's mux fields, runs with a session flag that `enforce_review_edit_window` and media-change triggers (D2 queue) skip, and does not touch `updated_at`.
- Validation trigger: max 4 items, max 1 `type='video'`.
- `mux-register-mappings` stays post-only (not needed for reviews). Catch-up: if the upload is already ready at save time, the trigger calls the patch.
- `allowVideo` on only in `ReviewComposerScreen` and `TimelineComposerScreen`; `photoOnlyReviews.test.tsx` keeps legacy forms photo-only.
- Extract shared player from `FeedVideo` (`renderBranching`, `hlsAttach`, `prewarmMuxHls`, `useVideoMute`, handoff); `useVideoViewTracker` stays in the post wrapper. `YelpStyleMediaPreview` plain `<video>` replaced by it.
- Inventory doc: `docs/verification/review-video.md`. Roadmap gets a separate future item: Mux asset cleanup.
