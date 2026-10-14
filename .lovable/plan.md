# Post composer: stop the pause when processing finishes

## What's actually happening
The last fix kept your local copy on screen, but the composer still hands the player an updated version of the video when processing finishes. That version carries the new Mux address and "ready" status. The player treats the address change as a new video: it unloads and reloads your local copy, so it lands on 0:00 paused while the button still shows "playing".

## Fix (/create only)
- While a video you just picked has a local copy, the composer keeps passing the player the original, unchanged item. The "ready" version is no longer passed in, so nothing changes from the player's point of view, and it just keeps playing.
- The "Ready" chip and the Post button still read Mux's status directly. They keep working as they do now.
- Saved videos (editing a post) have no local copy, so they still use the Mux version.
- Review and Timeline composers are unchanged (still deferred). The shared video player and the feed are untouched.

## Technical details
- Cause: `FeedVideo`'s source-attach effect depends on `item.url`, `mux_playback_id` and `mux_status`. `preparedComposerMedia` rewrites `url` to the HLS address on Ready. The effect re-runs, detaches the source (`removeAttribute('src'); load()`) and reattaches the same blob. Line ~357's url-change reset also fires.
- Change in `EnhancedCreatePostForm`: build the preview media as `media.map(item => item.id && localPreviewUrlsRef.current.has(item.id) ? item : prepared[i])`. In other words, skip the projection for items that have a local preview.
- Tests: a rendered test where the ready status arrives for a locally previewed item. The `<video>` element keeps the same `src` and is not reloaded, and saved videos still get the projection. Then the full suite and typecheck.
- No server, database, feed, FeedVideo or Review-video setting changes.
