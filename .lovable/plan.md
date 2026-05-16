## Goal

Make single portrait images in the feed match Twitter's exact sizing, based on the measured Computed values you provided.

## Twitter's measured values (from your screenshots)

- Outer frame width: **403.31px**
- Outer frame height: **512px**
- max-width: **403.314px**
- Frame aspect ratio: 403/512 ≈ **0.787** (essentially 4:5 = 0.8)
- Behavior: Twitter caps portrait images to a 4:5 frame and crops anything taller (cover), so there are no letterbox bars.

## Current behavior (portrait image branch in `computeShape`)

- `ratio: Math.min(intrinsic, 4/5)` ✅ already caps at 4:5
- `maxWidth: '440px'` — too wide
- `maxHeight: 'min(680px, 85vh)'` — too tall
- `fit: 'contain'` — would show grey/black bars if intrinsic is taller than 4:5

## Changes (scoped to `src/components/media/FeedCollage.tsx` only)

### `computeShape` — portrait image branch (the `else` after the `if (isVideo)` inside `intrinsic < 0.95`)

- `ratio: Math.min(intrinsic, 4/5)` — unchanged
- `maxWidth: '403px'` (was `'440px'`)
- `maxHeight: 'min(512px, 75vh)'` (was `'min(680px, 85vh)'`)
- `fit: 'cover'` (was `'contain'`) — matches Twitter; safe because:
  - When intrinsic ≤ 4:5, the frame ratio equals the intrinsic ratio → nothing is cropped, just eliminates subpixel seams.
  - When intrinsic < 4:5 (taller than 4:5), Twitter crops to the 4:5 frame — `cover` reproduces this exactly.

### Placeholder branch (image side)

- `maxWidth: '403px'` (was `'440px'`)
- `maxHeight: 'min(512px, 75vh)'` (was `'min(620px, 80vh)'`)
- Keep `fit: 'contain'` for the placeholder (it never actually shows media; just a brief frame before measurement).

## Explicitly NOT changing

- Portrait video (already tuned to 287×508)
- Square images / videos
- Landscape images / videos
- Multi-item collages
- `FeedVideo.tsx`, composer, lightbox, upload pipeline

## Expected result

Single portrait images render at ≤403px wide and ≤512px tall, capped at a 4:5 frame with no grey/black side bars — visually matching Twitter.
