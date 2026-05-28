# Fix blurry video in lightbox on iPhone Chrome (phased)

## Why this happens

Feed and lightbox load the same Mux HLS URL into a freshly-mounted `<video>`. On iOS (Safari + Chrome, both native HLS), the browser picks the starting rendition from a cold bandwidth estimate — it usually starts low and ramps up.

- **Feed:** small element, low rendition looks fine.
- **Lightbox:** large element, same low rendition looks blurry.
- **Close + reopen:** a brand-new `<video>` mounts → cold start again → blurry again. The feed video meanwhile kept playing and ramped up, so it looks sharp when you return.

This is native-HLS ABR behavior. Mux exposes manifest query params to nudge it.

## Approach (phased, lightbox-only)

### Phase 1 — ship now

- Lightbox Mux URL gets `?rendition_order=desc` only.
- `rendition_order=desc` makes the manifest list the highest renditions first, so native HLS picks high to start, but lower renditions stay available if the network truly can't keep up.
- **Do NOT add `min_resolution=720p` yet** — it removes the safety rungs and can cause rebuffering on weak mobile data.
- Feed path is byte-identical to today.

### Phase 2 — only if Phase 1 isn't enough

- Add `min_resolution=480p` (or `720p`) to the lightbox URL, ideally iOS-only or behind a small flag.
- Decide after real-device testing on iPhone Chrome / Safari.

## Changes (Phase 1 only)

1. **`src/utils/muxMedia.ts`**
   - Extend `muxHlsUrl(playbackId, opts?)` to accept `{ renditionOrder?: 'asc' | 'desc'; minResolution?: '480p' | '720p' | '1080p' }`. Append params via `URLSearchParams` when present. No opts → identical output to today.
   - Extend `resolveVideoSrc(m, opts?)` to forward `opts` to `muxHlsUrl` when the item is Mux-playable. Default behavior unchanged → every existing feed call site is untouched.

2. **`src/components/media/LightboxPreview.tsx`**
   - In the existing `resolveVideoSrc(item)` call inside `videoRefCallback`, pass `{ renditionOrder: 'desc' }`. No other changes — attach/detach, handoff, poster overlay, reveal logic all stay exactly as they are.

That's the entire diff. No inline URL building, no new helper file, no feed touch.

## Out of scope

- `attachHls.ts`, iOS-vs-MSE branching, `FeedVideo`, `useVideoAutoplay`, `useVideoMute`, `prewarmMuxHls`, lightbox layout/posters/handoff, the temporary `[hls][debug_gate]` logs. All untouched.
- Phase 2 (`min_resolution`) — deferred until Phase 1 is verified on device.

## Verification

- **iPhone Chrome + Safari:** open a feed video → lightbox opens sharp on first frame. Close + reopen → still sharp.
- **Slow-network simulation (iOS Safari Web Inspector → 3G):** lightbox should still play without long rebuffer pauses (this is what `desc`-only protects).
- **Feed videos:** byte-identical URL → identical behavior, identical autoplay reliability.
- **Desktop Chrome / Android:** lightbox starts at higher rendition too (fine for those surfaces).

## Risk

Minimal. `rendition_order=desc` only changes manifest ordering; lower renditions remain available as a fallback. Worst-case: lightbox uses slightly more bandwidth on the first segment, which is acceptable for an explicit large-format view.
