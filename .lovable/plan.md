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
- **Video only on public reviews.** On "Only me" or "Circle" reviews, the video button is off with a note: "Videos are available on public reviews." Changing a review with a video from public to private or Circle is blocked until the video is removed. The server enforces this too. Private video playback is future work.
- Removing a saved video: it disappears, its link is marked unlinked, the Mux video is not deleted. The link record is kept as history.
- Existing unlinked Mux videos are left alone. Mux cleanup is a separate later phase.

## Limits — where each is enforced

| Limit | On screen | On server |
|---|---|---|
| 4 items, 1 video | Yes | Save is rejected |
| Public only | Yes | Save is rejected |
| 60 seconds | Yes, before upload | After processing, a longer video is marked "too long" and never plays; the author sees "Video too long — replace it" |
| 100 MB | Yes, before upload | The upload slot is created with the declared size and the server refuses requests over 100 MB. The 60-second check is the real backstop, because Mux does not report file size |

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

## Internal "video ready" update

- Only the server's Mux process can do it. Normal users can never trigger it.
- It changes only the playback fields of the one matching, still-linked video. Never text, rating, recommending, other photos, owner, or times.
- It works after the 1-hour edit window and never triggers photo cleanup.

## Phases

1. Server foundation and tests (no screen changes). Tests prove: users cannot use the internal update; it works after the edit hour; removed or deleted videos ignore late messages; repeated and out-of-order messages are safe; no photo is queued for cleanup; other media untouched; someone else's upload cannot be attached; private and over-limit saves are rejected; posts unchanged.
2. New Review and Timeline pages (create and edit): video picker, upload stages, poster, "Processing" chip, compatibility hint, public-only rule.
3. Final check of every place review media is drawn (including cover images), then one shared video player from the feed: streaming, processing/error/too-long poster, autoplay in view, one playing at a time, hover pre-load, shared mute, lightbox resume at the same second. Post view tracking stays with posts.
4. Integration and browser checks, then your signed-in checklist.

## Extra suggestions

- Cover image: when a review's first item is a video, the review's cover uses the Mux poster image so cards and entity pages still show a picture.
- Admin visibility: the existing Mux status card gets a count of review videos by state, so stuck ones are easy to spot.
- Future roadmap items: Mux cleanup (abandoned, removed, deleted and historical uploads, with a grace period and final checks) and private-review video playback.

## Not touched

Posts, legacy forms, rollout switch, photo cleanup, notifications, existing unlinked Mux videos.

## Technical details

- Ownership: `reviews.user_id` and `review_updates.user_id` both exist; trigger requires `mux_uploads.user_id = NEW.user_id` and, for updates, the parent review owner too. Client-supplied `mux_playback_id`/`mux_status` are overwritten from `mux_uploads`, never trusted.
- Trigger on insert/update/delete of `media` upserts `mux_upload_mappings` (`review` | `review_update`); removed → `unlinked` with `unlinked_at`; rows never deleted. Conflicts reject the save.
- Visibility: validation trigger rejects any video in `reviews.media` / child `review_updates.media` unless parent `visibility = 'public'`; also rejects visibility change while videos are present.
- Bypass: `patch_content_media_from_mux` (SECURITY DEFINER, EXECUTE revoked from anon/authenticated) sets a transaction-local setting; edit-window and D2 triggers skip only when that setting is set AND `current_user` is the function owner, AND the diff is limited to the mux fields of the mapped slot (trigger re-verifies).
- Duration: when `mux_uploads.duration > 60`, patch writes `mux_status='errored'`, `mux_error='too_long'`, no playback id.
- Size: `mux-create-upload` accepts `declared_size`, rejects > 100 MB; Mux upload settings remain unchanged for posts.
- `allowVideo` only in `ReviewComposerScreen` and `TimelineComposerScreen`; legacy photo-only tests kept.
- Shared player extracted from `FeedVideo`; `useVideoViewTracker` stays in post wrapper; `YelpStyleMediaPreview` uses it.
- `reviews.image_url` set to Mux thumbnail when first item is video; D2 only matches storage photo paths, so Mux posters are never queued (verified in tests).
