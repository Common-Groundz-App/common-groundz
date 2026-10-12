# Phase 2 — Video on the new Review and Timeline pages (create and edit), revised

Scope: only the new Review page, Timeline Update page and their edit pages. Showing review videos elsewhere (cards, entity pages, lightbox, autoplay) is Phase 3. Posts, legacy popup/inline forms, photo cleanup, the composer rollout switch and existing Mux videos are untouched. Built behind a new "Review videos" setting that stays OFF; turning it on publicly waits for the end-to-end checks.

Phase 1's three concurrency races stay recorded as "overlap unverified". Phase 2 testing does not resolve them.

## What the author will see

- Picker accepts photos and one video (4 items total, max 1 video, 100 MB, 60 seconds), using the same upload components as /create (reused, not copied): progress stages, "Processing" chip, preparing poster, compatibility hint.
- Public-only rule, shown before saving:
  - Review create/edit: Private and Circle are disabled with a reason while the review itself OR any of its timeline updates has a video. Picking a video is disabled while visibility is Private/Circle.
  - Timeline create/edit: video allowed only when the parent review is public.
  - The server rule from Phase 1 stays the final authority; the screen only explains it earlier.
- Edit (within the hour): existing video shows its state (processing, ready poster, failed/too long) and can be removed or replaced. After the hour the page stays read-only.
- A failed or too-long video can be removed within the hour; saving with it attached is blocked with a plain message.

## Upload and save contract

| Video state | Save | Cancel / remove |
|---|---|---|
| Uploading (file still transferring, or upload not yet created) | Blocked: "Wait for your video to finish uploading" | Stops the transfer, releases the slot once |
| Processing (Mux has the file) | Allowed | Removes it from the draft; nothing deleted from Mux |
| Ready | Allowed | Same |
| Failed / too long, new and never saved | Blocked until removed | Same |
| Failed / too long, already saved (failed after saving while Processing) | Allowed: the owner can edit text/rating and leave it as is | Can be removed or replaced within the hour; locked with the rest after the hour |

- The open page follows Mux live: a video moves from Processing to Ready or Failed without reloading, including one that finishes before Save (existing status hook from /create).
- Leave-page protection includes an active transfer.
- Late callbacks from a cancelled upload or an earlier session are ignored (existing session id check), and slots stay correctly counted.
- Videos only go through Mux. If Mux is unavailable or its upload setting is off, video picking is disabled or shows a retry error; review screens never fall back to storing a video as a plain file (posts keep their current fallback).
- The screen never writes the video-link records itself; the Phase 1 save rules link, unlink and fill trusted Mux details in the same save.

## New vs saved videos when saving

- Newly attached video: the screen sends only type, upload id and order (plus the address only if the existing format needs it). Playback, status, error and asset details always come from the server.
- Saved video the author did not change: sent back exactly as loaded, never rebuilt from a smaller object, so no trusted detail is dropped. Today's save always sends the full media list, so round-tripping is the path used; the Phase 1 rules re-check it.
- The screen never invents Mux details, and no longer computes the cover itself when a video is involved — the server already recomputes it.
- Media order is preserved.
- Saved-result checks compare the author's fields only and tolerate Mux details the server fills in during processing.

## Turning the "Review videos" setting off

- Stops new video picking and new uploads only.
- Saved videos stay visible on the edit pages, survive unrelated edits and can still be removed within the hour.
- Sessions already open keep finishing their current upload safely; new actions follow the new setting (same as the agreed mid-draft rule).
- Never changes video-link records or Mux videos.

## Tests

- Unit: limits, thread-wide visibility lock both ways, parent-private timeline block, save contract table, slot accounting, late/cancelled callbacks, no plain-file fallback, error messages, setting OFF keeps saved videos, legacy forms still photo-only.
- Database (rolled back, made-up Mux details, no real uploads):
  - an existing ready video survives an unrelated text/rating edit with trusted state intact (review and timeline);
  - removal within the hour marks its link removed;
  - replacement within the hour marks the old link removed and links the new upload;
  - nothing is deleted from Mux;
  - saving with the setting OFF cannot strip a saved video.
- Browser checks with mocked uploads and saves for all four modes: Review create, Review edit, Timeline create, Timeline edit. Covers public + video, photo + video, save while processing, remove/replace within the hour, Private/Circle blocking, parent-private timeline blocking, setting OFF regression.
- Signed-in real checks only after you authorize them separately. I report results and stop before Phase 3.

## Technical details

- `ReviewComposerScreen` / `TimelineComposerScreen`: `allowVideo = flag && muxUploadsEnabled && publicContext`; drop `canRemove` video restriction within the window regardless of flag.
- Review loader adds `threadHasVideo` (root media or any `review_updates.media` with `type='video'`); timeline loader exposes parent visibility.
- Review composer video uploads call a Mux-only upload path (`uploadVideoViaMux` with `declared_size`), never the `MUX_DISABLED` storage fallback in `uploadMedia`.
- New `app_config` row `reviews.video_enabled` (false), added to `get_public_flags`, `parsePublicFlags` (fail closed) and the admin `ALLOWED_KEYS` list — a small database config change.
- `serverErrors.ts`: `review_video_public_only`, `review_video_visibility_locked`, too many items, more than one video, not your upload, `expired`.
- No changes to triggers, edge functions or posts.
