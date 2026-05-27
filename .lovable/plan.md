## Diagnosis

The debug gate proved the real issue. Console on `commongroundz.co/home?hlsdebug=1` shows:

- `HLS_DEBUG: true` ✅
- `canPlayNativeHls: true`
- `path=native`

So `attachHls()` runs, but the current top-of-function branch hands the `.m3u8` to the browser via `video.src = src` and returns. None of the hls.js instrumentation or ABR config (`abrEwmaDefaultEstimate`, `capLevelToPlayerSize`, `MANIFEST_PARSED`, `LEVEL_SWITCHING`, `FRAG_LOADED`, fatal-error handler) ever runs in this Chrome session. That is why earlier ABR tuning produced no visible change and why no `[hls][manifest_parsed]` / `[hls][level_*]` / `[hls][frag_loaded]` logs ever appeared.

Chrome normally returns `""` for `application/vnd.apple.mpegurl`, but in this environment (extension, flag, or Chromium variant) it returns a truthy value, so the current `if (video.canPlayType(...))` check wins on desktop Chrome and locks us out of hls.js.

Fix direction (matches both reviewers and the Stack Overflow pattern for this exact symptom): prefer `hls.js` when `Hls.isSupported()` is true, and fall back to native HLS only when MSE is unavailable (real Safari / iOS).

## Plan

Scope: **only `src/utils/hlsAttach.ts`**. No other files.

1. **Invert branch priority.** Remove the early `if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = src; return; }` block at the top of `attachHls()`. Replace it with a deferred decision taken after the dynamic `import('hls.js')` resolves:
   - `Hls.isSupported()` true → use hls.js (MSE path). This covers desktop Chrome, Edge, Firefox, Android Chrome.
   - Else if `video.canPlayType('application/vnd.apple.mpegurl')` is truthy → native HLS fallback (Safari, iOS — they lack MSE so they naturally land here).
   - Else → `onUnrecoverable('hls_unsupported')` (unchanged).

2. **Native fallback on dynamic-import failure.** If `import('hls.js')` itself rejects (network block, chunk 404), and the browser supports native HLS, set `video.src = src` instead of calling `onUnrecoverable`. This preserves Safari's "it just plays" behavior when the hls.js chunk fails to load.

3. **Add explicit decision-reason log** (Codex's suggestion). Right after the branch is chosen, emit exactly one of:
   - `[hls][debug_gate] decision=mse_supported`
   - `[hls][debug_gate] decision=native_fallback_no_mse`
   - `[hls][debug_gate] decision=native_fallback_import_failed`
   - `[hls][debug_gate] decision=unsupported`
   
   This makes triage trivial without parsing multiple log lines.

4. **Keep cancellation and cleanup intact.** `token.cancelled` checks before assigning `video.src` and before constructing/attaching `Hls`. Cleanup function still calls `hls?.destroy()` and `detachNative(video)`.

5. **Keep existing `[hls][debug_gate]` proof logs**:
   - Entry log: `attachHls called` with `href`, `search`, `HLS_DEBUG`, `src`, `canPlayNativeHls`.
   - Pre-import log: `importing hls.js`.
   - Post-import: `hls.js loaded` with `isSupported`.
   - Plus the new `decision=…` line above.
   
   These stay until we confirm `decision=mse_supported` on the deployed domain; removal is a follow-up.

6. **Do NOT change** the `Hls` constructor config, event handlers (`MANIFEST_PARSED`, `LEVEL_SWITCHING`, `LEVEL_SWITCHED`, `FRAG_LOADED`, `ERROR`), `__muxHlsLive` counter, `onUnrecoverable` signature/reasons, or the public `attachHls()` signature/return type.

7. **Out of scope.** No edits to `prewarmMuxHls.ts`, `FeedVideo.tsx`, lightbox/handoff, composer, upload pipeline, Tier 1/2 prewarm, flag bridge, admin, DB, RPCs. No ABR tuning (`abrEwmaDefaultEstimate`, `capLevelToPlayerSize`, `testBandwidth`) in this step.

## Technical details

File: `src/utils/hlsAttach.ts`

Pseudocode after the change:

```text
attachHls(video, src, token, opts):
  log [hls][debug_gate] attachHls called { href, search, HLS_DEBUG, src, canPlayNativeHls }
  log [hls][debug_gate] importing hls.js

  import('hls.js').then(({ default: Hls }) => {
    if (token.cancelled) return
    log [hls][debug_gate] hls.js loaded { isSupported }

    if (Hls.isSupported()) {
      log [hls][debug_gate] decision=mse_supported
      construct Hls, attach diagnostics + ERROR handler, loadSource, attachMedia   // unchanged
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      log [hls][debug_gate] decision=native_fallback_no_mse
      video.src = src
    } else {
      log [hls][debug_gate] decision=unsupported
      onUnrecoverable('hls_unsupported')
    }
  }).catch(err => {
    if (token.cancelled) return
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      log [hls][debug_gate] decision=native_fallback_import_failed
      try { video.src = src } catch {}
    } else {
      log [hls][debug_gate] hls.js import failed { err }
      emit('mux_hls_load_failed', { src, err: String(err) })
      onUnrecoverable('hls_load_failed', String(err))
    }
  })

  return cleanup:
    hls?.destroy()
    detachNative(video)
```

## Verification (after deploy)

On `/home?hlsdebug=1` in desktop Chrome:

- Expect `[hls][debug_gate] decision=mse_supported` (replacing today's `path=native`).
- Expect `[hls][construct]`, `[hls][manifest_parsed]`, `[hls][level_switching]`, `[hls][level_switched]`, and up to 5 `[hls][frag_loaded]` lines as the video plays.
- Network panel should show the `hls.js` chunk loaded once, then `.m3u8` + `.ts`/`.m4s` segments fetched via XHR/fetch (hls.js), not as native media element requests.

On Safari (any device): expect `decision=native_fallback_no_mse` and the video to play exactly as before.

Once those logs appear, the existing hls.js ABR config is finally active, and we can evaluate the blur separately and decide on actual ABR tuning in a follow-up.
