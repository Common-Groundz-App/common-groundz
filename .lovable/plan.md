# Plan — Fix Mux feed-lightbox handoff and sizing (LightboxPreview only)

The feed opens `src/components/media/LightboxPreview.tsx` (not `photo-lightbox.tsx`). The remaining Mux bugs (pause on open, small/blurry intermediate frame, late resize) live there. Fix is scoped to this single file.

## What will change

1. **Reserve final aspect ratio from the very first render**
   - Wrap the `<video>` in an aspect-ratio box derived from `currentItem.width / currentItem.height`, falling back to `16 / 9`.
   - The wrapper keeps the lightbox content box at the final size for the entire poster → attach → metadata sequence, so the player never shrinks or pops.

2. **Keep a high-res Mux poster visible until the video is truly ready**
   - For Mux items, render a Mux thumbnail (`muxThumbnailUrl(playback_id, { width: 1280 })`) as an absolutely positioned `<img>` on top of the `<video>`.
   - The `<video>` stays visually hidden (`opacity-0`) until both:
     - HLS is attached, and
     - the video has fired `loadeddata` (or `readyState >= 2`) and the handoff seek has completed.
   - Then fade the poster out and the video in — no blurry intermediate frame.

3. **Gate the handoff (seek + play) on HLS readiness for Mux**
   - Keep the existing `handoffAppliedRef` one-shot guard exactly as-is.
   - For Supabase (`isHls === false`): keep current behavior (handoff in `onLoadedMetadata` / `onSeeked`) — unchanged.
   - For Mux (`isHls === true`): defer the seek+play to a new `hlsReady` signal, fired when:
     - `attachHls` has run (sync on Safari/iOS native HLS, async on hls.js), AND
     - the `<video>` has reached `loadedmetadata` (so duration is known and seeking is safe).
   - Sequence: set `muted` from handoff → clamp+seek to `initialVideoState.currentTime` → on `seeked`, if `wasPlaying`, call `play()` with the existing muted-retry fallback.
   - This eliminates the “pause on open” because we no longer rely on the browser autoplay timing — we explicitly play after the seek lands.

4. **Preserve iOS first-tap invariant**
   - The iOS synchronous ref-callback `play()` path (invariant #4 in the file header) stays exactly as-is and continues to run before HLS attach. The new HLS-ready gate only affects the non-iOS / non-early-play branches.

5. **Preserve existing cleanup**
   - Ref-callback unmount path (cancel HLS token + detach) is unchanged.
   - The new poster-overlay `<img>` and `videoReady` state reset on `key={imageKey}` change automatically.

## Out of scope

- `photo-lightbox.tsx` — not used by the feed path
- `FeedVideo.tsx`, `FeedCollage.tsx`, `PostMediaDisplay.tsx` — feed playback unchanged
- `renderBranching.ts`, `muxMedia.ts`, `hlsAttach.ts` — shared utilities unchanged
- DB / edge functions / upload pipeline / composer — untouched
- Supabase video lightbox behavior — must remain bit-for-bit identical

## Technical details

- New local state in `LightboxPreview`: `videoReady: boolean`, reset whenever `imageKey` changes.
- `videoReady` flips to true after both the HLS-ready signal and `loadeddata` for the current `<video>`.
- Poster overlay `<img>` styles: `absolute inset-0 object-contain`, fades out on `videoReady`.
- `<video>` is mounted from the start (so HLS can attach) but rendered with `opacity-0` until `videoReady`, then `opacity-100` with a short transition.
- Aspect-ratio wrapper uses inline `style={{ aspectRatio }}` so the layout is stable before any media metadata arrives.
- The 5 handoff invariants in the file header are preserved. The iOS early-play branch is unchanged. Only the non-iOS Mux branch now waits for HLS-ready before seeking/playing.

## Verification

After implementing, I will verify in the preview:
- Mux video: opens at full lightbox size immediately, no shrink/pop, no blurry frame, no unexpected pause; resumes from the tapped feed timestamp; mute state preserved.
- Supabase video: identical behavior to before — continues from tapped timestamp, no pause, no resize.
- Switching between items in the lightbox cleans up HLS (no stale instances).
- No new console errors.