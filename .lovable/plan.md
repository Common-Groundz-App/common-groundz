## Goal
Make invalid/deleted Mux assets in the feed show `Video failed to load` instead of `This video format isn't supported on your device`, while keeping true legacy codec failures classified as `unsupported`.

## Plan
1. Inspect the feed video error-state race in the actual player path.
   - Re-check `FeedVideo.tsx`, `hlsAttach.ts`, `muxMedia.ts`, and the feed media renderer path to confirm the stale `phase 3B test` card uses `FeedVideo` + `attachHls`.
   - Verify there is no remaining non-native `.m3u8 -> video.src` fallback outside the Safari/iOS native HLS branch.

2. Add temporary runtime logging to isolate the sequence of events.
   - Log when `attachHls` is called for a Mux item.
   - Log when fatal HLS errors fire and when `onUnrecoverable` is invoked.
   - Log when `FeedVideo` transitions to `error` or `unsupported`.
   - Log the native `<video onError>` payload, including `video.currentSrc` and `video.error?.code`.
   - Use those logs in preview to confirm whether native `onError` is firing after the HLS fatal path and overwriting the earlier `error` state.

3. Fix the classification race in `FeedVideo.tsx`.
   - Preserve the current `onUnrecoverable => setStatus('error')` behavior for invalid/deleted Mux HLS assets.
   - Prevent a later native `onError(code === 4)` from downgrading an already-known HLS load failure from `error` to `unsupported`.
   - Keep true legacy/non-HLS codec failures mapped to `unsupported`.
   - Keep all existing UI/copy unchanged.

4. Audit the related preview paths without expanding scope.
   - Confirm the feed is not using an alternate video component for this post.
   - Confirm `LightboxPreview` still avoids raw `.m3u8` fallback and does not need broader UI changes.
   - Do not touch DB, webhook, hook contracts, playback flow, or Mux config.

5. Validate in preview.
   - Reproduce the stale `phase 3B test` case and verify it now lands on `Video failed to load`.
   - Confirm a normal working Mux post still reaches `ready` and plays.
   - Confirm legacy/non-HLS unsupported behavior still shows the existing unsupported message only for real native media failures.
   - Remove the temporary logs once the behavior is verified.

## Technical details
- Most likely root cause: a race where `attachHls(... onUnrecoverable)` sets `status = 'error'`, but a later native `<video onError>` event still fires with `MediaError.code === 4` and overwrites the state to `unsupported`.
- The surgical fix is to make `FeedVideo` remember that an HLS unrecoverable failure already occurred and treat the subsequent native media error as part of the same load-failure path instead of a codec-unsupported path.
- Files likely involved:
  - `src/components/media/FeedVideo.tsx`
  - `src/utils/hlsAttach.ts`
  - possibly `src/components/media/LightboxPreview.tsx` only for parity/logging review

## Out of scope
- No DB changes
- No webhook/edge changes
- No hook contract changes
- No UI/copy changes
- No Phase 4/5 playback redesign