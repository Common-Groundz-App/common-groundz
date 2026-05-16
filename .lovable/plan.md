## Goal

Single portrait video in the feed should render at Twitter's exact size (~287×508) with zero black sidebars. Everything else stays untouched.

## Diagnosis

The current `FeedCollage.tsx` already uses the intrinsic ratio for portrait video (no 3/4 cap) and `maxWidth: 300px` / `maxHeight: min(510px, 75vh)`. Two things still cause the issues the user sees:

1. **Slightly too large** — caps are 300/510 instead of Twitter's measured 287/508.
2. **Black sidebars** — the outer wrapper uses `bg-black` and the inner video uses `object-fit: contain`. Any subpixel rounding between the wrapper's `aspect-ratio: <intrinsic>` and the `<video>`'s own rendering can expose 1–2px of the black wrapper on the sides. Because the wrapper's aspect-ratio is already exactly the video's intrinsic ratio, `object-cover` cannot crop anything meaningful — it just removes the rounding gap.

## Changes (scoped to `src/components/media/FeedCollage.tsx` only)

### `computeShape` — portrait video branch
- `ratio: intrinsic` (unchanged — already correct, no clamp)
- `maxWidth: '287px'` (was `'300px'`)
- `maxHeight: 'min(508px, 75vh)'` (was `'min(510px, 75vh)'`)
- `fit: 'cover'` (was `'contain'`) — safe because the frame ratio equals the intrinsic ratio, so cover and contain are visually identical except cover hides subpixel gaps that produce the black bars.

### Placeholder branch (used only before metadata resolves)
- For video: `maxWidth: '287px'`, `maxHeight: 'min(508px, 75vh)'`, keep `fit: 'cover'`.
- Image placeholder values untouched.

### `SingleMediaTile` wrapper
- Keep `bg-black` as the brief pre-measurement fallback (prevents a white flash).
- No other change. Inner `<video>` already gets `w-full h-full` via `FeedVideo`, and `FeedVideo` already passes `objectFit` straight to the `<video>` element.

### Measurement order
Already implemented and correct:
1. Stored `width`/`height` on the `MediaItem`
2. `thumbnail_url` via `new Image()` probe
3. Detached `<video preload="metadata">` probe with 2s timeout

Once `intrinsic` is non-null, `computeShape` uses it directly — no fallback to placeholder ratio. No change needed here.

## Explicitly NOT changing

- Portrait images, square media, landscape media
- Multi-item collages (2/3/4+)
- `FeedVideo.tsx` internals (controls, autoplay, mute, tracking)
- Composer, lightbox, upload pipeline, view tracker

## Expected result

Single portrait video renders at ≤287px wide and ≤508px tall — visually matching Twitter — with no black sidebars in any state (placeholder, loading, playing).

## Why `object-cover` is safe here

`object-cover` only crops when the element's box ratio differs from the media's ratio. Since the wrapper is built with `aspectRatio: intrinsic`, the box ratio IS the media ratio, so there is nothing to crop — but it eliminates any 1px rounding seam that `object-contain` would letterbox in black.
