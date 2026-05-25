# Plan — Fix lightbox black screen (LightboxPreview only)

Root cause: the new aspect-ratio wrapper introduced in the previous step has only `aspectRatio` + `max*` constraints, so inside the flex-centered lightbox parent it can resolve to 0×0. Since the `<video>` and Mux poster are absolutely positioned children of that wrapper, both Mux and Supabase videos render as a black screen.

Fix is scoped to `src/components/media/LightboxPreview.tsx`. No other files change.

## Changes

1. **Defensive non-zero sizing on the aspect-ratio wrapper**
   - Compute `const rawRatio = currentItem.width && currentItem.height ? currentItem.width / currentItem.height : 16 / 9;`
   - Guard: `const ratio = Number.isFinite(rawRatio) && rawRatio > 0 ? rawRatio : 16 / 9;`
   - Wrapper styles:
     - `position: relative`
     - `display: block` (so `aspectRatio` is honored — never flex/inline)
     - `aspectRatio: ratio` (numeric)
     - `width: min(100%, calc(var(--lb-max-vh) * ${ratio}))` where `--lb-max-vh` is `85vh` on mobile landscape, `90vh` otherwise
     - `maxWidth: 100%`
     - `maxHeight: var(--lb-max-vh)`
     - `minWidth: 1px`, `minHeight: 1px` (collapse guard)
   - This gives the browser a real intrinsic width AND a fallback max box, so the flex parent can never collapse it to 0.

2. **Poster + video remain absolute children of the wrapper**
   - `<img>` Mux poster: `absolute inset-0 w-full h-full object-contain`
   - `<video>`: `absolute inset-0 w-full h-full object-contain`, `opacity-0` until `videoReady`, then `opacity-100` with a short transition.
   - Supabase branch: `videoReady` initialized `true` (or branch renders video without the fade gate) so behavior stays bit-for-bit identical to pre-regression.

3. **Temporary DEV-only breadcrumbs** (one verification run, behind `import.meta.env.DEV`, prefixed `[LightboxPreview Mux]`):
   - `hlsAttached`
   - `loadedmetadata`
   - `seekApplied`
   - `seeked`
   - `playRequested`
   - `videoReady=true`
   These get removed after the user confirms behavior is correct.

4. **All previously preserved invariants stay intact**
   - iOS synchronous first-tap play path: unchanged
   - `handoffAppliedRef` one-shot guard: unchanged
   - HLS cleanup (cancel token + detach on unmount / media change / close): unchanged
   - Supabase video handoff (seek + play on `loadedmetadata`/`onSeeked`): unchanged

## Out of scope

`photo-lightbox.tsx`, `FeedVideo*`, `FeedCollage`, `PostMediaDisplay`, `muxMedia.ts`, `hlsAttach.ts`, `renderBranching.ts`, DB, edge functions, composer.

## Verification

- Supabase video: opens at full size immediately, no black screen, resumes from feed timestamp, no pause, no resize.
- Mux video: opens at full lightbox size immediately with high-res poster, no black screen, no shrink, video crossfades in once HLS + seek complete, resumes from tapped timestamp, mute preserved.
- Switching items cleans up HLS (no leaks).
- DEV console shows breadcrumb ordering: `hlsAttached → loadedmetadata → seekApplied → seeked → playRequested → videoReady=true`.
- After confirmation, remove the DEV breadcrumbs in a follow-up edit.
