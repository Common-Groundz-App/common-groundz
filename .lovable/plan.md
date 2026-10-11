# Review video (Mux) — final plan

Reuse the existing post video system. No second system. Built in 4 phases, server first.

## Confirmed facts

- Home feed shows posts of type "review", not reviews. They already support video. Out of scope.
- No review or timeline notifications exist. Out of scope.
- Review privacy is real: "Only me" and "Circle" reviews (and their timeline updates) are hidden from other people by the database. 1 private review exists today.
- Post videos use public playback links. Anyone with a link can watch.
- Post limits: 4 items, 1 video, 100 MB, 60 seconds. Reviews use the same.
- Video upload records store the owner, status and length (after processing), but not file size.

## Rules

- Applies only to the new Review page and the new Timeline page (create and edit), and the places that show review media.
- Old popup and old inline timeline form stay frozen and photo-only.
- Max 4 items, max 1 video, mixing allowed.
- **Video only on public reviews.** On "Only me" or "Circle" reviews, the video button is off with a note: "Videos are available on public reviews." Changing a review from public to private or Circle is blocked while the review **or any of its timeline updates** has a video. The server enforces this too, and a visibility change and a new timeline video saved at the same moment cannot both get through. Private video playback is future work.
- Removing a saved video: it disappears, its link is marked unlinked, the Mux video is not deleted. The link record is kept as history.
- Existing unlinked Mux videos are left alone. Mux cleanup is a separate later phase.

## Limits — where each is enforced

| Limit | On screen | On server |
|---|---|---|
| 4 items, 1 video | Yes | Save is rejected |
| Public only (whole thread) | Yes | Save or visibility change is rejected |
| 60 seconds | Yes, before upload | Checked from Mux's own measurement after processing. Too long: marked "too long", never plays |
| 100 MB | Yes, before upload | Partial only. The server refuses upload requests that declare more than 100 MB, but the browser tells us the size, so a modified app could lie. Mux does not report the uploaded file's byte size. Same as posts today. Recorded as a known limitation |

## Cover picture

The review's cover always follows its current first item:

- first item is a video: the video's Mux poster (once ready; until then the next photo, or none);
- first item is a photo: that photo;
- items removed or reordered: recomputed from the new first item;
- no items: cleared, the normal fallback shows;
- a removed video's poster is never left behind.

The cover is recalculated by the server on every save and when a video becomes ready. The "video ready" step may only set the cover when its video is still the first item.

## Save and upload states

- Save waits while a video is still **uploading**. Save is allowed once the upload is finished, even if Mux is still **processing**.
- Linking happens inside the same save on the server, so a saved review always has its video linked.
- If the connection drops after a save that succeeded, the existing "checking whether it saved" handling is kept unchanged.

| Case | Result |
|---|---|
| Upload finishes, user cancels | Nothing saved; video stays unlinked |
| Save fails | Nothing saved; draft and video stay on screen to retry |
| Video removed or replaced before Save | Never linked |
| Video removed or replaced while processing, after save | Old link unlinked; late Mux messages for it are ignored |
| Mux finishes before the save | Save links it and marks it ready immediately |
| Edit save fails | Old video stays linked and shown |
| Review or update deleted | Links unlinked; video kept |
| Mux processing fails | Video shows "Couldn't process this video" to the author; others see nothing for that slot |
| "Too long" or failure arrives after the 1-hour edit window | Author gets a "Remove video" button on that item. It removes only the broken video (allowed after the hour, nothing else can change). Other people never see a broken video |

## Internal "video ready" update

- Only the server's Mux process can do it. Normal users can never trigger it.
- It changes only the playback fields of the one matching, still-linked video, plus the cover when that video is first. Never text, rating, recommending, other photos, owner, or times.
- It works after the 1-hour edit window and never triggers photo cleanup, with photo cleanup switched on or off.

## Phases

Built one phase at a time. **This approval covers Phase 1 only.** I stop after Phase 1 and report what changed plus real test results; video stays switched off on every review screen until you approve Phase 2.

1. Server foundation and tests (no screen changes). Tests prove: users cannot use the internal update; it works after the edit hour without changing edit times; removed or deleted videos ignore late messages; repeated and out-of-order messages are safe; no photo is queued for cleanup (cleanup on and off); other media untouched; cover rules above; someone else's upload cannot be attached; private and over-limit saves are rejected; "Remove video" works after the hour, only for a video Mux itself marked as failed, removes nothing else and recalculates the cover; posts unchanged.
   Real database tests with two connections at the same moment (not simulated): visibility change vs timeline video save; video ready vs video removal; video ready vs reordering.
2. New Review and Timeline pages (create and edit): video picker, upload stages, poster, "Processing" chip, compatibility hint, public-only rule.
3. Final check of every place review media is drawn (including cover images), then one shared video player from the feed: streaming, processing/error/too-long poster, autoplay in view, one playing at a time, hover pre-load, shared mute, lightbox resume at the same second. Processing and failed videos keep their space in the layout (a neutral placeholder), and the author always sees how to fix it. Post view tracking stays with posts.
4. Integration and browser checks, then your signed-in checklist: create/edit, processing, privacy and playback.

Accepted temporary limitations: 100 MB is checked from the size the browser reports; unlinked Mux videos are kept until the later Mux cleanup phase.

## Extra suggestions

- Cover image: when a review's first item is a video, the review's cover uses the Mux poster image so cards and entity pages still show a picture.
- Admin visibility: the existing Mux status card gets a count of review videos by state, so stuck ones are easy to spot.
- Future roadmap items: Mux cleanup (abandoned, removed, deleted and historical uploads, with a grace period and final checks) and private-review video playback.

## Not touched

Posts, legacy forms, rollout switch, photo cleanup, notifications, existing unlinked Mux videos.

## Technical details

- Ownership: `reviews.user_id` and `review_updates.user_id` both exist; trigger requires `mux_uploads.user_id = NEW.user_id` and, for updates, the parent review owner too. Client-supplied `mux_playback_id`/`mux_status` are overwritten from `mux_uploads`, never trusted.
- Trigger on insert/update/delete of `media` upserts `mux_upload_mappings` (`review` | `review_update`); removed → `unlinked` with `unlinked_at`; rows never deleted. Conflicts reject the save.
- Visibility: both the `review_updates` media trigger and the `reviews` visibility trigger take `SELECT ... FOR UPDATE` on the parent `reviews` row first, so concurrent visibility change and timeline-video save serialize; reject video unless parent public; reject non-public visibility while root or any child update has a `type='video'` item.
- Bypass: `patch_content_media_from_mux` (SECURITY DEFINER, EXECUTE revoked from anon/authenticated) sets a transaction-local setting; edit-window and D2 triggers skip only when that setting is set AND `current_user` is the function owner, AND the diff is limited to the mux fields of the mapped slot plus `reviews.image_url` (trigger re-verifies).
- Duration: when `mux_uploads.duration > 60`, patch writes `mux_status='errored'`, `mux_error='too_long'`, no playback id.
- Size: `mux-create-upload` accepts `declared_size`, rejects > 100 MB. Client-declared, not authoritative; documented limitation (also true for posts).
- Remove broken video: owner-only SECURITY DEFINER RPC `remove_errored_review_video(content_type, content_id, mux_upload_id)` removes only a slot whose mux_status is errored, allowed past the edit window, unlinks the mapping; no other field may change.
- Cover: one SQL helper `review_cover_from_media(media)` used by the save trigger and the patch; returns Mux thumbnail for a ready first video, else first photo, else NULL.
- `allowVideo` only in `ReviewComposerScreen` and `TimelineComposerScreen`; legacy photo-only tests kept.
- Shared player extracted from `FeedVideo`; `useVideoViewTracker` stays in post wrapper; `YelpStyleMediaPreview` uses it.
- D2 only matches storage photo paths, so Mux posters are never queued; tests run with cleanup processing on and off.
