# Tier 1 — Exact-Frame Handoff Poster (final)

Goal: make Mux lightbox opening feel visually continuous like Supabase. On tap, snapshot the exact current frame from the feed `<video>` and use it as the lightbox cover until the real video is ready.

Scope is additive and presentational only — no changes to HLS attach, forward handoff, reverse handoff, scroll lock, sizing, DB, backend, upload pipeline, composer, or feed playback architecture.

## Changes folded in from review

1. **Single callback (no ordering risk).** Extend the existing `onTap` signature to `onTap(handoff?, extras?)`. The snapshot ships with the tap event in the same React batch, so `LightboxPreview` never mounts a render before `entryPosterDataUrl` is available. No new `onExtras` prop.
2. **UI-local type.** `LightboxEntryExtras` lives in `src/components/media/lightboxTypes.ts` (new), not in shared `src/types/media.ts`.
3. **Broader CORS-safe host matcher.** Accept the configured Supabase host AND any `*.supabase.co` / `*.supabase.in` subdomain (covers Storage CDN edge cases, transformation CDN, custom storage subdomains) in addition to `stream.mux.com`.
4. **`crossOrigin` set at first render, never toggled.** Computed in the render body from `resolveVideoSrc(item)` (same call site used by the attach effect). Never added or removed in an effect — that would force a reload and break playback.
5. **Smaller dataURL.** 640px wide, JPEG quality 0.65 (~80–120KB).
6. **Explicit cleanup.** Null `entryExtras` in `PostMediaDisplay.handleLightboxClose` alongside `setVideoHandoff(null)`. Never store the dataURL in a ref.

## Behavior

1. User taps a Mux feed video that is playing.
2. `FeedVideo.handleContainerClick` builds the existing `VideoHandoff`, calls `captureVideoFrame(v)` synchronously, and invokes `onTap(handoff, { entryPosterDataUrl })` in a single call.
3. `PostMediaDisplay` receives both, stores `videoHandoff` and `entryExtras` in the same handler (single React batch).
4. `LightboxPreview` uses `entryExtras.entryPosterDataUrl` as the cover for the entry item until `videoReady === true`, then fades to the live video exactly like today.
5. Fallback chain when no snapshot (image tap, capture failed, paused pre-first-frame, unknown host):
   - Mux entry item with handoff `currentTime > 0` → `muxThumbnailUrl(playbackId, { time: currentTime, width: 1280 })`
   - Otherwise → existing `muxPosterUrl(item)` / `muxThumbnailUrl(playbackId, { width: 1280 })`. Unchanged.

## Files

| File | Change |
|---|---|
| `src/components/media/lightboxTypes.ts` (new) | Export `LightboxEntryExtras { entryPosterDataUrl?: string }`. UI-local. |
| `src/utils/captureVideoFrame.ts` (new) | Best-effort canvas snapshot, returns dataURL or null, never throws. |
| `src/utils/corsSafeHosts.ts` (new) | `isCorsSafeVideoHost(url)` — matches `stream.mux.com`, configured Supabase host, and `*.supabase.co` / `*.supabase.in` subdomains. |
| `src/types/media.ts` | Extend `VideoHandoff` callers' type only if needed — actually no change: extras are a second argument, not a field. **No edit.** |
| `src/components/media/FeedVideo.tsx` | Render `<video crossOrigin="anonymous">` only when host is CORS-safe (computed in render body). In `handleContainerClick`, capture frame and pass extras as second arg to `onTap`. Update `FeedVideoProps.onTap` signature. |
| `src/components/media/FeedCollage.tsx` | Update internal `onTap` forwarding to pass through both args; update prop signature on `onItemTap` (or equivalent) to `(originalIndex, handoff?, extras?)`. |
| `src/components/feed/PostMediaDisplay.tsx` | Store `entryExtras` state; set it in the same handler that sets `videoHandoff`; clear both in `handleLightboxClose`; pass `entryExtras` prop to `LightboxPreview`. |
| `src/components/media/LightboxPreview.tsx` | New optional prop `entryExtras?: LightboxEntryExtras`. Compute `coverPoster = (isEntryItem && entryExtras?.entryPosterDataUrl) ?? muxFallbackPoster` and use for both `<video poster>` and the overlay `<img src>`. |

No changes to `useVideoMute`, `hlsAttach`, `useVideoAutoplay`, `muxMedia.ts`.

## Key snippets

### `src/utils/captureVideoFrame.ts`

```ts
/**
 * Best-effort JPEG dataURL snapshot of a <video>'s current visible frame.
 * Returns null on any failure (tainted canvas, pre-first-frame, zero dims,
 * SecurityError). Never throws. Tuned for a 1–3s bridge frame, not archival.
 */
export function captureVideoFrame(
  v: HTMLVideoElement,
  opts?: { maxWidth?: number; quality?: number }
): string | null {
  try {
    if (!v || v.readyState < 2) return null;
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return null;
    const maxW = opts?.maxWidth ?? 640;
    const scale = vw > maxW ? maxW / vw : 1;
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', opts?.quality ?? 0.65);
  } catch { return null; }
}
```

### `src/utils/corsSafeHosts.ts`

```ts
/**
 * Returns true only for hosts known to serve media bytes with
 * Access-Control-Allow-Origin: *, so <video crossOrigin="anonymous">
 * loads AND canvas reads stay untainted. Anything else returns false
 * — caller must omit the crossOrigin attribute entirely.
 */
const configuredSupabaseHost = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL ?? '').host; }
  catch { return ''; }
})();

export function isCorsSafeVideoHost(src: string | undefined | null): boolean {
  if (!src) return false;
  try {
    const h = new URL(src, window.location.href).host;
    if (h === 'stream.mux.com') return true;
    if (configuredSupabaseHost && h === configuredSupabaseHost) return true;
    // Covers storage CDN / transformation / custom Supabase subdomains.
    if (h.endsWith('.supabase.co') || h.endsWith('.supabase.in')) return true;
    return false;
  } catch { return false; }
}
```

### `src/components/media/lightboxTypes.ts`

```ts
/**
 * Transient view-only extras carried alongside VideoHandoff from a feed
 * video to LightboxPreview. NOT part of the shared media domain types.
 */
export interface LightboxEntryExtras {
  entryPosterDataUrl?: string;
}
```

### `FeedVideo.tsx` key diffs

```ts
// In FeedVideoProps:
onTap?: (handoff?: VideoHandoff, extras?: LightboxEntryExtras) => void;

// In FeedVideoPlayer render body (computed once per render, stable per item):
const resolvedForCors = srcOverride ?? resolveVideoSrc(item).src;
const corsSafe = isCorsSafeVideoHost(resolvedForCors);

// In <video> JSX — spread so unsafe hosts get NO attribute at all:
<video
  ref={videoRef}
  {...(corsSafe ? { crossOrigin: 'anonymous' as const } : {})}
  poster={...}
  /* ...rest unchanged... */
/>

// In handleContainerClick, after building handoff and BEFORE v.pause():
const dataUrl = captureVideoFrame(v);                  // null on any failure
const extras = dataUrl ? { entryPosterDataUrl: dataUrl } : undefined;
try { v.pause(); } catch {}
onTap(handoff, extras);
```

Snapshot before pause so we get the live frame, not a stale paused one.

### `FeedCollage.tsx`

Mirror the new two-arg shape wherever `onTap` is forwarded (single-tile and grid paths):

```ts
onTap={disableItemClick
  ? undefined
  : (handoff, extras) => onItemTap?.(originalIndex, handoff, extras)}
```

Update the `onItemTap` prop type to `(index: number, handoff?: VideoHandoff, extras?: LightboxEntryExtras) => void`.

### `PostMediaDisplay.tsx`

```ts
const [entryExtras, setEntryExtras] = useState<LightboxEntryExtras | null>(null);

const handleVideoTap = (index: number, handoff?: VideoHandoff, extras?: LightboxEntryExtras) => {
  setVideoHandoff(handoff ?? null);
  setEntryExtras(extras ?? null);   // same batch as setVideoHandoff
  openLightboxAt(index);             // existing logic
};

const handleLightboxClose = () => {
  setLightboxOpen(false);
  setVideoHandoff(null);
  setEntryExtras(null);              // explicit cleanup, drops dataURL
};

// Pass entryExtras={entryExtras ?? undefined} to <LightboxPreview>.
```

### `LightboxPreview.tsx` (Mux branch only)

```ts
const isEntryItem = currentIndex === entryIndexRef.current;
const entryPoster = isEntryItem ? entryExtras?.entryPosterDataUrl : undefined;
const posterTime =
  isEntryItem && initialVideoState && initialVideoState.currentTime > 0
    ? initialVideoState.currentTime
    : undefined;
const muxFallbackPoster = isMux
  ? muxThumbnailUrl(currentItem.mux_playback_id!, { width: 1280, time: posterTime })
  : muxPosterUrl(currentItem);
const coverPoster = entryPoster ?? muxFallbackPoster;
```

Use `coverPoster` in both the `<video poster>` attribute and the existing overlay `<img>`. `videoReady` fade logic unchanged.

## Verification

1. **Mux playing → tap** → lightbox shows the exact tap-time frame → fades smoothly into live video. No black flash, no thumb pop, no layout flicker.
2. **Mux paused / pre-first-frame** → snapshot null → time-based Mux thumbnail (or 0s thumb if `currentTime === 0`). Same as today.
3. **Capture failure** (CORS edge, taint, decoding quirk) → `captureVideoFrame` returns null silently → Mux fallback runs. No console errors leaked.
4. **Unknown host** (legacy non-Mux non-Supabase CDN) → `crossOrigin` attribute omitted → video plays exactly as today, snapshot returns null, fallback runs.
5. **Supabase videos** → still play, snapshot now works as a bonus.
6. **Forward + reverse handoff, mute sync, entry-index logic, ESC/backdrop/swipe close** → untouched. `LightboxPreview.handoff.test.tsx` still passes.
7. **Image items** → no `FeedVideo` tap path → no snapshot, no behavior change.
8. **Memory** → `entryExtras` cleared on close, never stored in a ref, dataURL eligible for GC immediately.
9. **iOS** → tap-gesture chain (early-play ref-callback path) unaffected; capture + `onTap` run synchronously inside the same click handler.
10. **No reload** from `crossOrigin` — attribute is present on first render and never toggled.

## Out of scope

- Tier 2 (HLS manifest + first-segment prewarm)
- Tier 3 (same-element DOM reparenting)
- `photo-lightbox.tsx`, composer, DB, edge functions, feed query logic
- Any change to forward/reverse handoff semantics
