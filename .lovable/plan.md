## Decision

Agreed with ChatGPT's read. Two parallel actions:

1. **Old "phase 3B test" post** — stale test data. Its `mux_playback_id` returns `404 Invalid Playback ID` directly from Mux (confirmed via curl). Delete it (your call — DB row in `posts`, id `23b4943b-53b6-416c-b43e-2df216636c9b`) or just leave it; not a code bug.
2. **Ship the small frontend hotfix** so any future invalid / deleted / expired Mux asset fails gracefully with "Video failed to load." + Retry, instead of the misleading "format isn't supported" overlay.

This is exactly the Phase 5.2 hardening pass ChatGPT described. Narrow, defensive, no contract changes.

## Root cause recap

`src/utils/hlsAttach.ts` has three fallbacks in the MSE path that do `video.src = src` when hls.js fails. On Chromium that assigns a raw `.m3u8` to `<video>`, which Chrome can't play natively → `HTMLMediaElement.error.code === 4` → `FeedVideo` maps to `'unsupported'` → wrong copy.

## Changes (frontend only)

### 1. `src/utils/hlsAttach.ts`

- Add to `AttachHlsOptions`:
  ```ts
  onUnrecoverable?: (
    reason: 'hls_unsupported' | 'hls_fatal' | 'hls_load_failed',
    detail?: unknown
  ) => void;
  ```
- Remove all three `video.src = src` fallbacks inside the MSE branch:
  - `!Hls.isSupported()` → call `onUnrecoverable('hls_unsupported')` and return.
  - Fatal `Hls.Events.ERROR` → keep existing `emit('mux_hls_fatal', ...)`, destroy hls, call `onUnrecoverable('hls_fatal', data.type)`. Do **not** mutate `video.src`.
  - `import('hls.js').catch(err)` → keep existing `emit('mux_hls_load_failed', ...)`, call `onUnrecoverable('hls_load_failed', String(err))`. Do **not** mutate `video.src`.
- Native HLS path (Safari/iOS): unchanged.
- Cleanup / `detachNative` / `__muxHlsLive` counter: unchanged.

### 2. `src/components/media/FeedVideo.tsx`

In the `useEffect` that calls `attachHls`, wire:
```ts
detach = attachHls(v, src, token, {
  onEvent: (e, p) => analytics.track(e, p),
  onUnrecoverable: () => setStatus('error'),
});
```
`handleError` stays as-is — true codec failures on legacy MP4s still map to `'unsupported'` via `video.error.code === 4`. The existing `'error'` overlay already shows "Video failed to load." + Retry, which is the correct copy for "manifest 404 / MSE missing / hls.js failed to load".

### 3. `src/components/media/LightboxPreview.tsx`

Same wiring at the existing `attachHls` call site (line ~330): add `onUnrecoverable: () => { /* set local error state if one exists, else no-op */ }`. If LightboxPreview has no explicit error UI today, at minimum pass an empty callback so we don't accidentally re-introduce the bogus fallback indirectly later. I'll confirm the exact state hook when implementing; copy stays "Video failed to load." for consistency with `FeedVideo`.

### 4. Nothing else

- No DB / migration / webhook / edge function changes.
- No Phase 4 playback logic, no Phase 5 / 5.1 code touched (`useMuxStatus`, `MuxOwnerHint`, `MuxUploadChip`, `PostView` refetch timer, `dismissedReadyChips`).
- No new deps. No type changes outside `AttachHlsOptions`.

## Verification

- `/home` "phase 3B test" card now shows **"Video failed to load." + Retry** instead of the format-unsupported overlay.
- New posts (working Mux assets) still autoplay normally.
- Safari/iOS path unchanged (still uses native HLS via `video.src`).
- Analytics: `mux_hls_fatal` / `mux_hls_load_failed` still emit once per failure (already wired).
- `tsc --noEmit` clean.
- Optional: delete the broken test post from DB once confirmed.

## Rollback

Per-file revert. All three changes are local and self-contained.