## Scope
`src/components/media/LightboxPreview.tsx` only.

## Root cause
The `<video ref={(el) => {...}}>` uses an **inline arrow function**, so its identity changes on every render. React's contract: when a ref callback's identity changes, React calls the old one with `null`, then the new one with the element — on **every render**.

That means every re-render runs the cleanup branch (`hlsTokenRef.cancelled = true`, `hlsDetachRef()` which executes `removeAttribute('src'); load()`) and then re-attaches the source. This:

1. Resets the `<video>` mid-playback, which is why the native loading spinner reappears in a loop (each cycle: src cleared → src re-set → buffering → loadeddata → `setVideoReady(true)` → re-render → cleared again).
2. Breaks the handoff — `currentTime` is wiped to 0 and any pending `play()` promise is cancelled, so the lightbox opens paused even when `wasPlaying: true`.
3. Affects both Mux and Supabase paths (both go through the same ref callback).

The recent defensive-sizing edits did not introduce the inline ref — but the introduction (or earlier wiring) of `videoReady` state + `setVideoReady` calls turned a latent bug into a visible loop, because now there is a re-render after first load that triggers the destructive cleanup.

## Fix

1. **Stabilize the video ref callback with `useCallback`**
   - Wrap the existing ref-callback body in `useCallback(..., [])` so its identity is stable across renders. React will then only invoke it on real mount/unmount (and on `key={imageKey}` change, which is exactly when we *do* want to re-attach).
   - Move values the callback currently closes over (`currentItem`, `currentIndex`, `initialVideoState`, `entryIndexRef.current`) onto refs that are updated each render:
     - Add `currentItemRef`, `currentIndexRef`, `initialVideoStateRef`, each assigned at the top of the render (`currentItemRef.current = currentItem;` etc.).
     - Inside the stable callback, read from `*.current` instead of the closed-over values.
   - `entryIndexRef`, `handoffAppliedRef`, `earlyPlayRanRef`, `videoElRef`, `hlsDetachRef`, `hlsTokenRef` are already refs — keep them as-is.
   - `isIOS()` and `analytics.track` are pure / module-level — fine to keep referenced directly.

2. **Belt-and-suspenders guard inside the callback**
   - At the top of the attach branch: `if (el === videoElRef.current) return;` — no-op if React ever re-invokes with the same element we already attached.
   - At the top of the detach branch (`!el`): only run teardown if `videoElRef.current` is non-null (i.e., we actually had an attachment). Prevents spurious teardown if React calls with `null` before any attach.

3. **Leave everything else untouched**
   - Keep `key={imageKey}` on `<video>` — that's the legitimate remount trigger when navigating between items.
   - Keep `onLoadedMetadata`, `onLoadedData`, `onSeeked` handlers exactly as-is (they're inline but that's fine — React doesn't re-bind DOM event handlers destructively the way it does refs).
   - Keep iOS synchronous early-play branch inside the callback (it still runs on real mount, preserving the tap-gesture chain).
   - Keep the defensive wrapper sizing, `aspectRatio`, `maxVh`, Mux poster overlay, `videoReady` state, and all handoff invariants in the file header comment.

4. **Do NOT touch**
   - `useEffect` for `setVideoReady(false)` on `currentIndex` change (still needed and correct).
   - `attachHls`, `muxMedia.ts`, `FeedVideo*`, `PostMediaDisplay`, `MuxOwnerHint`, `photo-lightbox.tsx`, DB, edge functions, composer.
   - The `console.log('LightboxPreview portal target:', ...)` at line 642 — out of scope.

## Verification

1. **Supabase upload video**: tap a playing feed video → lightbox opens, resumes at the exact timestamp, keeps playing, no spinner loop, no shrink, mute preference preserved.
2. **Mux upload video**: tap a playing feed video → poster visible at full lightbox size immediately, no black flash, HLS attaches once (check Network tab — only one `.m3u8` request, not a repeating burst), video crossfades in once `onSeeked` lands, resumes at the tapped timestamp, keeps playing.
3. **Paused-handoff case**: tap a paused feed video → lightbox opens paused at the same timestamp, no spinner loop while idle.
4. **Navigation between items**: arrow keys / arrows / dots → `key={imageKey}` change causes real remount → ref callback runs cleanly once per item, HLS detaches the previous attachment, attaches the new one.
5. **Re-render sanity check**: while the lightbox is open and a video is playing, trigger an unrelated re-render (e.g., `setChromeVisible` toggling on pointer move) — the video must not reset, the spinner must not reappear, and HLS must not re-attach.

After confirming all five, the handoff/continuity behaviour is restored to pre-regression state.
