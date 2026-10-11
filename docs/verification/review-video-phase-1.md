# Review video — Phase 1 (server foundation)

Status: applied and tested. No screen changes; video stays off in every review composer until Phase 2 is approved.

## What changed (database)
- `mux_upload_mappings.content_type` now allows `post | review | review_update`. Removed videos become `removed`; rows are never deleted (inventory for the later Mux cleanup phase).
- `zz_review_media_mux_before` (reviews + review_updates): max 4 items (always, on media change), max 1 video, video only when the parent review is public (parent row locked `FOR UPDATE`), uploader must be the author, upload not used by other content, client Mux fields replaced from `mux_uploads`. Review cover (`image_url`) recomputed from the first item on every media change. Review cannot leave public while it or any timeline update has a video.
- `zz_review_media_mux_after`: links/re-indexes/unlinks mappings in the same transaction as the save; delete marks them removed.
- `patch_content_media_from_mux`: review mappings routed to `patch_review_media_from_mux` (service-role only, locks content then mapping); post branch unchanged.
- Internal patch bypass (`app.mux_review_patch`) is honoured only when `is_trusted_server_context()` (no end-user JWT) AND the diff is exactly the trusted Mux state of one video slot (`review_mux_patch_is_valid`). Edit window and `updated_at` untouched.
- Over 60 s → `mux_status=errored, mux_error=too_long`, no playback id.
- `remove_broken_review_video(content_type, content_id, mux_upload_id)`: owner-only, only for uploads that `mux_uploads` itself marks errored/cancelled/too long; works past the edit hour. (Linter flags it as callable by signed-in users — intended.)
- review_updates have no direct-update policy and no edit-window trigger (the window lives in `edit_latest_review_update`), so the removal RPC is the only path.

## Edge function
- `mux-create-upload`: optional `declared_size`; > 100 MB → 413. Client-reported (limitation). Posts send `{}` and are unaffected.

## Test results (supabase/tests/review_video_phase1.sql, rolled back) — 31 passed, 0 failed
Trusted fields, same-save linking, cover while processing / ready, patch after edit hour, updated_at unchanged, no D2 queueing, duplicate event no-op, signed-in user with forged flag rejected (text and video), user cannot call internal patch, visibility locked (own video and timeline video), server flag cannot change text, 5 items / 2 videos / someone else's upload rejected, removal → mapping removed + cover recomputed, late event ignored, too_long, broken timeline video removed 3 h later with text/rating unchanged, healthy video removal refused, timeline patch, delete → removed, private review rejects video, cover cases 1–4b, photo-only timeline update saves.

Bug found and fixed by the tests: the first trigger version blocked all timeline update saves (review-only field read on timeline rows). Live for ~20 minutes; fixed.

## Not yet done
- Real two-connection concurrency tests (visibility vs timeline video, ready vs removal, ready vs reorder). Locks are in place; the tests need the `dblink` extension to open a second connection from the database.
- Broken-video removal on a root review after the hour (timeline path tested).
