## Root cause recap

Grey sidebars appear when the container's `aspectRatio` does not match the video's true ratio and the inner `<video>` uses `object-contain`. That happens whenever measurement falls back to the placeholder shape (`4/5 + contain + bg-muted`). Two reasons measurement is silently failing today:

1. `probe.crossOrigin = 'anonymous'` forces a CORS request on Supabase Storage URLs — when CORS headers are absent the probe errors before `loadedmetadata` fires.
2. There is no fallback path — if the video probe fails, we never try the poster image, which we already have and which carries the same dimensions.

## Plan — all edits scoped to `src/components/media/FeedCollage.tsx`

### 1. Measurement priority (most reliable → least)
Inside `SingleMediaTile`'s effect:

1. **Stored** `item.width` / `item.height` from the upload pipeline → use immediately, no probe.
2. **Poster image** (`item.thumbnail_url`) → measure via `new Image()` `naturalWidth`/`naturalHeight`. Cheap, no CORS, and already warm in cache.
3. **Detached `<video preload="metadata">` probe** → only as a last resort (legacy media with no width/height *and* no poster).

Remove `probe.crossOrigin = 'anonymous'`. Keep `preload="metadata"`, `muted`, `playsInline`, and existing cleanup (remove listeners, clear `src` on unmount).

Add a **2-second safety timeout** on the video probe: if `loadedmetadata` hasn't fired, give up gracefully so the tile can adopt the loading-fallback shape instead of hanging on the placeholder forever.

### 2. Twitter-style shapes (`computeShape`)

| Case | ratio | maxWidth | maxHeight | fit |
|---|---|---|---|---|
| Placeholder (intrinsic unknown), image | `4/5` | `440px` | `min(620px, 80vh)` | `contain` |
| Placeholder (intrinsic unknown), **video** | `4/5` | `380px` | `min(620px, 80vh)` | **`cover`** (temporary, prevents bars while loading) |
| Square (0.95–1.05) | `1` | `480px` | `min(560px, 80vh)` | `contain` |
| Portrait image | `min(intrinsic, 4/5)` | `440px` | `min(680px, 85vh)` | `contain` |
| **Portrait video** | `min(intrinsic, 3/4)` | **`380px`** (≈ Twitter scale) | `min(680px, 85vh)` | `contain` |
| Landscape (image or video) | `clamp(intrinsic, 5/4, 16/9)` | none (full column) | `min(560px, 80vh)` | `cover` |

Notes:
- Once intrinsic is known, container ratio = video ratio, so `contain` produces zero bars.
- `cover` is used **only** in the placeholder/video branch (while loading) and for landscape (where intrinsic is clamped and a tiny crop is preferable to bars).
- 380px portrait video matches Twitter's perceived in-feed scale much better than 520px.

### 3. Background color
Switch the outer wrapper and inner tile backgrounds from `bg-muted` → `bg-black`. Any transient letterbox now reads as cinematic black instead of a grey "broken card" frame. This also future-proofs against rare edge cases where clamp causes a 1px gap.

### 4. Out of scope (explicitly not touched)
- `FeedVideo.tsx` — autoplay, mute, view tracking, controls, `object-fit` prop wiring stay as-is.
- Multi-item collages (2/3/4+).
- Composer preview, lightbox, `LightboxPreview`.
- Upload pipeline (`mediaService.ts`) — width/height already persisted for new uploads.
- Feed normalization (`utils.ts`) — already passes through dimensions.

## Expected result

- **New uploads** (width/height stored): frame snaps to true ratio instantly, no probe, no flicker, no bars. ~380px portrait video matches Twitter scale.
- **Legacy media with poster**: poster's naturalWidth/Height drives the shape on first paint — still no bars.
- **Legacy media without poster**: brief `cover`-cropped preview against black, then snaps to true ratio once probe resolves (or stays cover-cropped if probe times out after 2 s — still no grey bars).
- Landscape video unchanged (full-width, no top/bottom bars).
- Square media centered at ~480px.

## Technical notes

- Poster-first measurement works because `generateVideoPoster` captures the video's true intrinsic frame, so the poster's image dimensions equal the video's `videoWidth`/`videoHeight`.
- The 2 s timeout is intentionally conservative — metadata is usually <100 ms; anything longer is a network/codec problem and shouldn't block the UI.
- `bg-black` is a Tailwind core class (not a semantic token) but is appropriate here because the media frame is intentionally cinematic, similar to how lightbox backgrounds are black across the app.
