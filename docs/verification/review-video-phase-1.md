# Review video — Phase 1 (server foundation)

Status: applied and tested. Close-out (strict one-hour rule) applied 2026-10-11. No screen changes; video stays off in every review composer until Phase 2 is approved. Concurrency tests pending separate approval of the helper.

## What changed (database)
- `mux_upload_mappings.content_type` now allows `post | review | review_update`. Removed videos become `removed`; rows are never deleted (inventory for the later Mux cleanup phase).
- `zz_review_media_mux_before` (reviews + review_updates): max 4 items (always, on media change), max 1 video, video only when the parent review is public (parent row locked `FOR UPDATE`), uploader must be the author, upload not used by other content, client Mux fields replaced from `mux_uploads`. Review cover (`image_url`) recomputed from the first item on every media change. Review cannot leave public while it or any timeline update has a video.
- `zz_review_media_mux_after`: links/re-indexes/unlinks mappings in the same transaction as the save; delete marks them removed.
- `patch_content_media_from_mux`: review mappings routed to `patch_review_media_from_mux` (service-role only, locks content then mapping); post branch unchanged.
- Internal patch bypass (`app.mux_review_patch`) is honoured only when `is_trusted_server_context()` (no end-user JWT) AND the diff is exactly the trusted Mux state of one video slot (`review_mux_patch_is_valid`). Edit window and `updated_at` untouched.
- Over 60 s → `mux_status=errored, mux_error=too_long`, no playback id.

## Close-out: strict one-hour rule (2026-10-11)
- Dropped `remove_broken_review_video(text, uuid, text)` (the only deployed version; `remove_errored_review_video` was never created). Catalog check: no function with either name remains.
- Also found and removed a second part of the exception: `enforce_review_edit_window` let an owner remove a broken video from a root review directly after the hour. That shortcut and its helpers (`review_media_is_broken_removal`, `mux_upload_is_broken`) are gone. After the hour, any author media change on a root review raises `review_edit_window_closed`.
- Timeline updates: signed-in users have no direct update permission at all; `edit_latest_review_update` returns `expired` after the hour.
- Owner options after the hour: delete the whole review / timeline update, or add a new timeline update.

## Edge function
- `mux-create-upload`: optional `declared_size`; > 100 MB → 413. Client-reported (limitation). Posts send `{}` and are unaffected.

## Test results (supabase/tests/review_video_phase1.sql, rolled back) — 39 passed, 0 failed
First run: 38 passed, 1 failed. The failure was the test's own expectation (the delete action answers `deleted`, not `ok`). Fixed the test and re-ran that case alone: deleted, row gone, link `removed`.

Kept: trusted fields, same-save linking, cover while processing / ready, patch after edit hour, updated_at unchanged, no D2 queueing, duplicate event no-op, forged flag rejected (text and video), user cannot call internal patch, visibility locked (own video and timeline video), server flag cannot change text, 5 items / 2 videos / someone else's upload rejected, removal → mapping removed + cover recomputed, late event ignored, too_long, timeline patch, delete → removed, private review rejects video, cover cases 1–4b, photo-only timeline update saves.

New: removal action no longer exists; timeline after hour — direct change refused (no permission), Edit removal and video swap return `expired`; root after hour — system marks video failed without moving edit time, owner removing only the broken video and swapping the video both refused (`review_edit_window_closed`); within the hour Edit replaces a video and the old link is marked removed; after the hour deleting a whole timeline update with a failed video works; after the hour deleting the whole review works and its links are marked removed; guard — the only signed-in-callable privileged function that writes review media is `edit_latest_review_update` (window-checked). The guard is an early warning only; the database rules and these behaviour tests remain the real protection.

## Earlier timeline-save outage
- Known: faulty change live from about 09:25 UTC to the fix at about 09:46 UTC on 2026-10-11. Cause: a review-only field check also ran on timeline updates. Fix applied and covered by the "photo-only timeline update saves" test.
- From the database: 0 timeline updates saved in that window (and none at all since 2026-10-08).
- Unknown: how many saves were attempted and failed. Server request logs for that window returned no data, so this can't be established. Missing rows are not taken as evidence either way.

## Not yet done
- Real two-connection concurrency tests (visibility vs timeline video, ready vs removal, ready vs reorder). Waiting on: a throwaway test account from the owner, then approval of the exact helper code, test records and cleanup steps. No database add-on will be installed.
