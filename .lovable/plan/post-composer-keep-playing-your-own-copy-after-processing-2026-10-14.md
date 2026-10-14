# Post composer: keep playing your own copy after processing

## Why it stutters today
When processing finishes, the preview swaps from the copy on your device to Mux's streamed version. The stream has to load from scratch, so the video pauses for about 2 seconds, jumps a frame, and then carries on.

## Why we don't need the swap
The Post button only checks Mux's ready status. It doesn't need the Mux player to be showing. Your local copy is the same video, so keeping it on screen is smooth and accurate. After you post, the feed uses the Mux version as it does now.

## What changes (/create only)
- A video you just picked keeps playing from your device the whole time, before and after processing. There's no swap, so no pause or jump.
- Nothing else changes:
  - "Processing" chip, then "Ready" chip
  - The Post button waits for Ready
  - X removes the video
  - Mute and pause stay as you set them
- Videos already saved on a post you're editing still play from Mux, because there's no local copy for them.
- Review and Timeline composers stay as they are. Making them match is still deferred.

## Technical details
- In `EnhancedCreatePostForm`, `previewSrcOverride` returns the local blob URL whenever one exists for `item.id`, regardless of Mux state.
- The `MuxUploadChip` overlay and `newMuxVideoSaveBlocker` are unchanged. `preparedComposerMedia` may still project ready fields, and the blob override wins for playback.
- Drop `resumeAfterSourceSwap` from the post composer, since no swap happens. The prop stays in FeedVideo, harmless and unused, or gets removed if nothing else uses it.
- Blob URLs are still revoked on remove and on unmount, as they are today.
- Tests:
  - The preview stays on the blob after Ready.
  - Saved Mux videos in edit mode keep using Mux.
  - Then the full suite and typecheck.
- No server, database, feed or Review-video setting changes.
