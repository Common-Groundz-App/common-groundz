# Post composer: stop the pause when processing finishes

## What's actually happening
The last fix kept your local copy on screen, but the composer still hands the player an updated version of the video when processing finishes. That version has the new Mux address and "ready" status, and the player treats the change as a new video. It unloads and reloads your local copy, which leaves it on 0:00 paused while the button still shows "playing".

## Fix (/create only)
- While a newly picked video has a local copy, the player keeps receiving the exact same, unchanged video details from start to finish. Nothing the player watches changes when processing finishes, so it just keeps playing.
- The "Ready" chip and the Post button keep reading Mux's status separately, so they work as they do now.
- Saved videos (when editing a post) have no local copy, so they still use the Mux version.
- Review and Timeline composers, the shared video player and the feed are untouched.

## Technical details
- Cause: `FeedVideo`'s source-attach effect depends on `item.url`, `mux_playback_id`, `mux_status` and `provider`, and `preparedComposerMedia` rewrites these on Ready. The effect then detaches and reattaches the same blob (`removeAttribute('src'); load()`), and the url-change reset (~line 357) also fires.
- Change in `EnhancedCreatePostForm`:
  - Build the preview list by matching each item to its prepared version by identity (`matchesMediaIdentity`: `id`, then `mux_upload_id`), never by array position.
  - Items that have a local preview get a frozen composer-only playback item. It's captured once per media `id` when the preview is created, held in a ref, and cleared on remove or unmount. This means no attach dependency can change, even if the raw `media` state is updated on Ready.
  - Ready/Post validation and the save payload don't read the frozen item. They keep using `muxStatuses` and `media` as today.
- Regression tests (rendered, with Processing → Ready arriving through mocked status):
  - With a locally previewed video, no `load()` call, no `removeAttribute('src')`, the same `<video>` element, and no pause.
  - A user-paused preview stays paused through Ready.
  - Remove and replace still work after Ready.
  - A saved Mux video with no local preview still gets the Mux version.
  - Ready/Post gating still follows Mux status.
  - Then the full suite and typecheck.
- After implementing, the change counts as fixed only once you repeat the real upload test: playback carries on through Ready without another click, and the controls match what the video is actually doing.
- No server, database, feed, FeedVideo or Review-video setting changes.
