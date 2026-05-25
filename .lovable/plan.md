## Goal

When Mux uploads are enabled, the composer preview currently renders a native `<video controls>` (browser chrome: fullscreen button, 3-dot menu, no hover states, no center play/pause). When Mux is off, the composer renders `FeedVideo` (custom UI: center play/pause, slim scrubber, mute toggle, hover reveal). Make the Mux-on path use the same `FeedVideo`-based player as Mux-off so both look and behave identically.

## Scope

Frontend / presentation only. No DB, edge function, `renderBranching.ts`, upload pipeline, or feed behavior changes. Feed callers do not pass `previewSrcOverride`, so feed is untouched.

## Changes

### 1. `src/components/media/FeedVideo.tsx`
- Add optional prop `srcOverride?: string` to `FeedVideoProps`.
- In the `FeedVideo` dispatcher: when `srcOverride` is set, **bypass** the `isMuxErroredOrBroken` and `isMuxPreparing` branches and render `FeedVideoPlayer` directly. This guarantees Mux-status checks don't hide the local preview.
- In `FeedVideoPlayer`'s source-attach effect: when `srcOverride` is set, treat as a plain legacy source — assign `v.src = srcOverride`, set `isHlsSourceRef.current = false`, skip `attachHls`. Add `srcOverride` to the effect's dep array.
- For the `<video poster=...>` attribute: when `srcOverride` is set, prefer `item.thumbnail_url` (the local poster) and fall back to `undefined` instead of `muxPosterUrl(item)` (which would point at a not-yet-ready Mux thumbnail).
- Everything else (mute toggle, scrubber, center play/pause overlay, hover/focus reveal, autoplay) is reused unchanged.

### 2. `src/components/media/FeedCollage.tsx`
- Remove the two `previewSrcOverride?.(item) ? <video controls .../> : <FeedVideo .../>` branches (in `renderTile` and `SingleMediaTile`).
- Replace with a single `<FeedVideo srcOverride={previewSrcOverride?.(item)} ... />` call. `FeedVideo` decides what to do based on `srcOverride`.
- `previewSrcOverride` prop signature unchanged; feed callers still don't pass it.

### 3. Untouched
- `ComposerMediaPreview.tsx`, `EnhancedCreatePostForm.tsx`: still build and pass `previewSrcOverride` exactly as today.
- `renderBranching.ts`, `muxMedia.ts`, `MuxPreparingPoster.tsx`, `MuxUploadChip.tsx`: unchanged.
- Feed and lightbox: unchanged (no `srcOverride` is ever passed to them).

## Behavior after change

- Mux ON, composer: identical UI to Mux OFF — center play/pause, slim scrubber, mute icon, hover reveal, no fullscreen/3-dot chrome.
- Mux ON, feed: unchanged (HLS player, no badge while preparing, error pill on failure).
- Mux OFF, composer and feed: unchanged.
- Object-URL lifecycle (revoke on remove/unmount/submit) unchanged — still managed by `EnhancedCreatePostForm`.

## Verification

- Mux ON + video upload in composer → see center play/pause, slim white scrubber, mute toggle; no browser-native chrome.
- Mux OFF + video upload → visually indistinguishable from Mux-ON composer.
- Mux ON + post → feed video plays via HLS, unchanged from today.
- Remove the video in the composer → no console errors, blob URL revoked.
