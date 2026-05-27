## Plan

Add a minimal, temporary diagnostic layer in `src/utils/hlsAttach.ts` only so we can prove why `[hls]` logs are missing before changing playback behavior.

### What I’ll change

1. Add a top-level proof log with prefix exactly `[hls][debug_gate]` using `console.log`, not `console.debug`.
2. Log these values whenever `attachHls()` is called:
   - `window.location.href`
   - `window.location.search`
   - computed `HLS_DEBUG`
   - that `attachHls()` was invoked
3. Log which branch is taken:
   - native HLS path
   - hls.js/MSE path
4. Add one or two proof logs around the dynamic import path so we can tell whether:
   - `import('hls.js')` resolves
   - `Hls.isSupported()` is false
   - the existing detailed HLS event logs are simply hidden because they use `console.debug`

### What I will not change

- No HLS config changes
- No playback changes
- No prewarm changes
- No lightbox/handoff changes
- No Supabase or Edge Function logging yet
- No other files

### Why this is the right next step

Right now we have not proven the failure mode. The missing logs could mean any of these:
- `attachHls()` is never called for the tested video
- the video is not a Mux/HLS item at runtime
- the browser is taking the native path instead of hls.js
- the deployed site is serving an older bundle than expected
- `console.debug` output is being hidden or suppressed in the environment

Remote logging to Supabase/Edge Functions is premature here. If `attachHls()` never runs, remote telemetry won’t help; it only adds noise, deployment overhead, and another failure point. First we should prove the code path locally with simple `console.log` breadcrumbs.

### About `?hlsdebug=2`

That URL still loading is normal. Query params do not make the route invalid. The page will render for `/home?hlsdebug=1`, `/home?hlsdebug=2`, or any other query string unless the app explicitly rejects it. The only intended difference is that debug mode should evaluate `true` only when the value is exactly `1`.

## Technical details

- File: `src/utils/hlsAttach.ts`
- Temporary log prefix: `[hls][debug_gate]`
- Temporary logging API: `console.log`
- Scope: proof-of-execution only, not new playback instrumentation

### Expected outcome after this change

When you open `/home?hlsdebug=1` and play a Mux video, we should immediately learn one of these:
- `attachHls()` is being called and `HLS_DEBUG` is `true`
- `attachHls()` is being called but the native path is used
- `attachHls()` is being called but `HLS_DEBUG` is unexpectedly `false`
- `attachHls()` is not being called at all

That result will tell us whether the next fix belongs in the diagnostic gate, the caller path, or deployment verification.