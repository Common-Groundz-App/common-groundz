# Phase 2 build: server rules for Post videos

## Old-posts report (done, read-only)

161 posts and 38 post videos (16 on Mux, 22 older stored files). No post has more than 4 items or more than 1 video, and no post video is over 60 s (the longest is 32 s). Every video has a stable identity.

**Known historical data, left out on purpose:** posts `d4941fd5-c594-433b-9501-9d339482f55b` (live) and `3e5b7e00-1c4b-49ca-8cc3-9cc1f31b5b6f` (deleted) each have a Mux video with no link record. They stay exactly as they are and won't be repaired or relinked, because their Mux assets may have been deleted. The new rules never touch them unless their media is changed.

## What gets built

1. **Max 4 items and max 1 video per post, checked by the server.** A save is refused only when it adds items or videos past the limit. Caption edits, unchanged media and removals always go through.
2. **60-second rule for new videos only.** Each Mux upload is marked "covered by the rule" when it is created, from the moment this ships. A covered upload that Mux reports as over 60 s becomes "too long" and never gets a playback link. Uploads made before this ships are never marked, so old videos keep playing.
3. **Only the server can set video state.** Status, playback ID, asset ID, length and error on post media can only be written by the trusted Mux path. A browser save that tries to set or change them is refused. A kept video must come back exactly as it was loaded.
4. **The uploader must be the post's author.** A new Mux video on a post is accepted only if that same user created the upload.
5. **Old stored-file videos aren't touched.** Items without Mux details pass through unchanged.
6. **/create doesn't change.** No app code changes in this phase. The two existing linking requests keep working (they're replaced in Phase 3).

## Tests (targeted, then stop and report)

SQL tests run on made-up records inside a transaction that's rolled back, so nothing real is changed. They cover:
- a 5th item is refused, and so is a 2nd video;
- an unrelated edit to an over-limit post goes through, and so does removing items from it;
- a covered upload over 60 s becomes "too long", while an old uncovered one stays ready;
- a browser save that sets a playback ID, status or length is refused;
- a kept video sent back exactly as loaded goes through;
- a video uploaded by another user is refused;
- an old stored-file video goes through untouched;
- the existing linking requests and the Mux patch still work;
- the two historical posts are unaffected.

I'll also run the existing app tests for the post composer and media, then report the results and stop before Phase 3.

## Technical details

- Migration: add `mux_uploads.duration_rule_applies boolean not null default false`, then change the default to `true` after the backfill. Existing rows stay `false`. Mapping repair never changes it.
- `posts_media_mux_before` (BEFORE INSERT/UPDATE OF media on `posts`, ordered after `media_guard` and `enforce_post_edit_window_trigger`). It mirrors `review_media_mux_before`: if the media is unchanged, it returns early. Otherwise it compares the new item and video counts against both the limits and the old counts. A Mux field changed by a non-trusted caller (`is_trusted_server_context()`) is refused. A new `mux_upload_id` must belong to `mux_uploads.user_id = NEW.user_id`. Error codes follow the `review_video_*` style (`post_media_too_many`, `post_video_too_many`, `post_video_untrusted_fields`, `post_video_not_owner`).
- In the post branch of `patch_content_media_from_mux`: when `duration_rule_applies and duration > 60`, write `errored` with error `too_long` and no playback ID.
- Mapping sync and retiring the edge functions stay in Phase 3.
- The SQL test file is `supabase/tests/post_video_phase2.sql`. The two historical post IDs get a note in the verification doc `docs/verification/post-video-phase-2.md`, and roadmap.md gets updated.
