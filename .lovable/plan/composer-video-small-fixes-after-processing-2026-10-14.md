# Composer video: small fixes after processing

## What changes
1. **No "Check video status" button while processing normally.** This applies to the Experience (/create), Review and Timeline composers. The "Processing video… wait until it is ready" text stays, and status checks keep running automatically. A small "Check again" link shows only if processing takes unusually long (over about 90 seconds), the automatic checks stop or fail, or the connection drops and comes back.
2. **X button works after processing finishes** on all three composers, and removes exactly that one item. The freed slot becomes available again right away.
3. **Video keeps playing when processing finishes on /create**, but only if it was actually playing. If you paused it, it stays paused. Mute stays as you set it, and the one-video-at-a-time rule still applies. If the browser blocks the automatic resume, the player shows as paused, never as falsely "playing". It may restart from the beginning; keeping the exact position is not required.

Review/Timeline "play during processing" alignment stays deferred.

## Technical details
- Removal identity: `id` first, then `mux_upload_id`. Never use array index or position. The URL is used only as a last resort for older photos that have neither. Do this end to end:
  - Post: `removeMedia` filters by this identity.
  - Review/Timeline: the `MEDIA_REMOVED` action takes `{ id?, muxUploadId?, url? }`, and the reducer matches in the same order.
  - Revoke the local preview by `id`.
  - The upload-slot count re-syncs from media length (already the case through `syncCommitted`). Verify this with a test.
- Recovery link: show it based on the time since the first processing state, the `useMuxStatus` check budget running out or a fetch error, or a reconnect. It fires the existing `mux:recheck`. No new polling.
- Source swap: a composer-only `resumeAfterSourceSwap` prop goes ComposerMediaPreview → FeedCollage → FeedVideo.
  - Before a `srcOverride` change, record whether the video was playing and not paused by the user.
  - After the new source loads, call `play()` through the existing manager, keeping the shared mute state.
  - If `play()` is rejected, the UI shows paused.
  - Feed behaviour, analytics and view tracking stay the same.
- Tests:
  - Ready-video removal in all three composers.
  - Mixed media (photo + video): one X removes exactly one item and frees one slot.
  - No button during normal processing; the link appears on timeout or failure.
  - Source swap while playing resumes; while paused, stays paused; on autoplay rejection, shows paused.
  - Then the full suite and typecheck.
- No changes to the server, database, Review-video setting or Mux assets.
