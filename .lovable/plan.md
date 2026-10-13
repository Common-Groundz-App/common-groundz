# Post videos vs Review videos — gap check

Both use the same upload service, Mux processing, video player, one-at-a-time playback, full-screen viewer and cancel handling. The real differences are in the server rules and in who sees a broken video.

## Things Posts are missing (that Reviews have)

Ranked by importance:

1. **Broken video badge shows to everyone.** On posts, "Couldn't process video" and "Preparing" show to every viewer. On reviews, only the owner sees them and everyone else sees nothing. This is the gap people will notice most.
2. **Limits are only checked in the browser.** Posts enforce 4 media and 1 video in the app only. Anyone calling the server directly can skip them. Reviews enforce both on the server.
3. **No server-side 60-second check.** Posts trust the browser's length check. If a long video gets through (like the no-length file), Mux processes it and it plays. Reviews mark anything over 60 s as "too long" on the server, and it never plays.
4. **Video state could be faked.** On reviews, only the server can mark a video as ready or set its playback link. On posts, nothing at the row level stops a post edit from writing those fields.
5. **Two-step save.** Posts save first, then link the video in a second request. If that second request fails, the video can be left stuck on "Preparing". Reviews do both in one save.
6. **No stable video IDs.** Post videos are keyed by their position in the list. Reviews use a fixed ID for each video, which keeps resume-playback correct after an edit.

## Things Reviews are missing (that Posts have)

- **View counts and analytics:** turned off for reviews on purpose (decided in Phase 3). Not a gap unless you want review video views counted.
- Nothing else important. Reviews are the stricter version of the same pipeline.

## Already noted for later, not changed here

- Posts' unknown-length gap (already on the roadmap as a separate decision). It's the same thing as item 3.
- Private playback links (Mux playback stays public for both).

## Proposed fix (only if you approve; Posts only, Reviews untouched)

- **Step 1 (low risk, visible):** hide "Preparing" and "Couldn't process" on post videos from everyone except the author, using the same rule reviews use.
- **Step 2 (server):** add the review-style server rules to posts: max 4 / 1 video, over 60 s marked too long, only the server can set video state.
- **Step 3 (optional):** link post videos in the same save, which removes the second request.

Each step would be tested against made-up records only, with existing posts and videos left untouched.

## Technical details

- Step 1: `FeedVideo` / `MuxPreparingPoster` need an `isOwner` check for `source="post"`.
- Step 2: a post-media BEFORE trigger that mirrors `review_media_mux_before` (counts, `is_trusted_server_context` guard on mux fields). Add `duration > 60` → `errored/too_long` in the post branch of `patch_content_media_from_mux`.
- Step 3: an AFTER trigger calling a mapping sync, replacing `mux-register-mappings` / `mux-sync-post-mappings` calls in `EnhancedCreatePostForm`.
