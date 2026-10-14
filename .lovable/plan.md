# Composer video: small fixes after processing

## What changes
1. **Remove "Check video status" button** on the Experience (/create), Review and Timeline composers. The "Processing video… wait until it is ready" text stays; automatic status checks keep running in the background.
2. **X button works after processing finishes.** The ready video can be removed on all three composers. Same fix applies to the Review and Timeline composers, which have the same bug (the screenshot was of Timeline).
3. **Video keeps playing when processing finishes on /create.** If the preview was playing when it switched to the ready video, it carries on playing (muted, as before) and doesn't stop paused. It may restart from the beginning; matching the exact position is not required (already agreed).

Review/Timeline "play during processing" alignment stays deferred, as you said.

## Technical details
- Cause of #2: `removeMedia` (EnhancedCreatePostForm) and `handleMediaRemove` (Review/Timeline screens → `MEDIA_REMOVED` by `url`) match by `url`. The preview passes the `preparedComposerMedia` projection, whose `url` is the Mux HLS address, so it doesn't match the stored item. Fix: map the clicked item back to its stored item by `id`, else by `mux_upload_id`, and remove that one (post: filter by id/upload id; review: dispatch with the stored item's `url`). The reducer stays the same.
- Cause of #3: `previewSrcOverride` goes from blob URL to undefined when the video is ready, so FeedVideo swaps sources and loses its playing state. Fix (composer only): FeedVideo resumes playback after a source swap if it was playing before. Scoped to a composer-only `autoplayAfterSourceSwap` prop passed via ComposerMediaPreview → FeedCollage. Feed behaviour, view tracking and the shared player manager stay the same.
- Tests: removal-after-ready for all three composers; no "Check video status" button; source-swap resume unit test. Then run the full suite.
- No server, database, Review-video setting or Mux asset changes.
