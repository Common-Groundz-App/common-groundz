## Diagnosis

On iOS, every browser (Safari, Chrome, Firefox, Edge) is WebKit / WKWebView under the hood. Since iOS 17.1, WebKit ships a Managed Media Source implementation, so `Hls.isSupported()` now returns `true` on modern iOS. After the branch-priority fix, iOS Chrome therefore takes the **MSE / hls.js** path instead of native HLS.

That is what broke autoplay on iOS Chrome:

- iOS WebKit applies stricter autoplay rules to MSE-backed `<video>` than to native HLS. Even `muted` + `playsInline` frequently needs a user gesture when the source is a `MediaSource` blob. Native HLS (direct `.m3u8` as `video.src`) is treated as "inline media" and autoplay-muted works reliably.
- That's why the same iPhone works in Safari (Safari historically lands on `native_fallback_no_mse` or its iOS-managed-MSE equivalent without breaking autoplay), Android Chrome and desktop Chrome are fine (no iOS autoplay rule), and `IMG_2428` shows a frozen first frame — hls.js attached and decoded one frag, but `video.play()` was silently rejected. Tapping (`IMG_2429`) works because it's a user gesture.

## Plan

Scope: **only `src/utils/hlsAttach.ts`**.

1. **Add a named helper** at module top (per ChatGPT's note — not inline):

   ```ts
   function isIOSLikeWebKit(): boolean {
     if (typeof navigator === 'undefined') return false;
     const ua = navigator.userAgent || '';
     const platform = navigator.platform || '';
     const maxTouchPoints = navigator.maxTouchPoints || 0;
     return /iPad|iPhone|iPod/.test(ua)
       || (platform === 'MacIntel' && maxTouchPoints > 1); // iPadOS reports as Mac
   }
   ```

2. **Add an iOS-prefers-native short-circuit** at the top of `attachHls`, *before* `import('hls.js')`:
   - Compute `isIOS = isIOSLikeWebKit()` and `canPlayNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl')`.
   - If `isIOS && canPlayNativeHls`:
     - Honor `token.cancelled` first.
     - Log `[hls][debug_gate] decision=native_ios_preferred`.
     - **Idempotent src assign** (Codex's tweak): only `video.src = src` when `video.src !== src`. Avoids restart flicker if `attachHls` is invoked again for the same element with the same source (StrictMode double-invoke, re-mount).
     - Do **not** call `video.load()` here — the previous native path did not, and a fresh `.load()` would defeat the idempotency guard.
     - Wrap in try/catch.
     - Return a cleanup closure that calls `detachNative(video)` only (no hls instance exists). Parity with existing native cleanup.
   - Skip the dynamic import entirely on this branch (saves the hls.js chunk on iOS).

3. **Keep the post-import branching intact** for desktop/Android: `decision=mse_supported`, `decision=native_fallback_no_mse`, `decision=native_fallback_import_failed`, `decision=unsupported`. Desktop quality win the user just confirmed is preserved.

4. **Update the entry debug-gate log** to include `isIOS` alongside `canPlayNativeHls`, `HLS_DEBUG`, `href`, `search`, `src`.

5. **Out of scope** (do NOT touch):
   - `Hls` constructor config (`enableWorker`, `lowLatencyMode`, `backBufferLength`, `capLevelToPlayerSize`, `abrEwmaDefaultEstimate`, `testBandwidth`).
   - `useVideoAutoplay`, `useVideoMute`.
   - Lightbox, `LightboxPreview`, handoff.
   - `prewarmMuxHls`, Tier 1/2 prewarm, flag bridge.
   - `FeedVideo.tsx`, composer, upload pipeline, admin, DB, RPCs.
   - Removing temporary `[hls][debug_gate]` proof logs — separate cleanup pass after iOS verification.

## Technical details

File: `src/utils/hlsAttach.ts`

Pseudocode for the new shape:

```text
function isIOSLikeWebKit(): boolean { ... }

attachHls(video, src, token, opts):
  const isIOS = isIOSLikeWebKit()
  const canPlayNativeHls = !!video.canPlayType('application/vnd.apple.mpegurl')

  log [hls][debug_gate] attachHls called { href, search, HLS_DEBUG, src, canPlayNativeHls, isIOS }

  // iOS always prefers native HLS, regardless of Hls.isSupported()
  if (isIOS && canPlayNativeHls) {
    if (token.cancelled) return () => detachNative(video)
    log [hls][debug_gate] decision=native_ios_preferred
    try {
      if (video.src !== src) video.src = src   // idempotent — no flicker on re-attach
    } catch {}
    return () => detachNative(video)
  }

  log [hls][debug_gate] importing hls.js
  import('hls.js').then(...)   // unchanged: mse_supported | native_fallback_no_mse | unsupported
    .catch(...)                // unchanged: native_fallback_import_failed | hls_load_failed
  return cleanup_with_hls_destroy
```

## Verification

iOS Chrome `/home?hlsdebug=1`:
- `[hls][debug_gate] decision=native_ios_preferred`
- No `[hls][construct]` / `[hls][manifest_parsed]` (hls.js never imported)
- Muted feed video autoplays again, no frozen first frame

iOS Safari: same `decision=native_ios_preferred`, behavior unchanged from before.

Desktop Chrome / Edge / Firefox / Android Chrome: still `decision=mse_supported`, quality improvement preserved.

Desktop Safari (Mac, not iPad): `isIOS=false` → falls through to `import('hls.js')` → `Hls.isSupported()` ? MSE : `native_fallback_no_mse`. No regression.

If iOS still freezes after this (unlikely), follow-up would be a one-time muted `video.play()` retry inside `useVideoAutoplay` — but we expect this branch fix alone to resolve it, since pre-fix iOS Chrome was on this native path and worked fine.
