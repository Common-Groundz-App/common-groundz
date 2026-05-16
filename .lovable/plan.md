## Goal
In multi-item collages (2, 3, 4+), render video tiles with `object-fit: contain` so portrait/landscape videos are letterboxed on a black background instead of cropped. Images stay `cover`. Single-media layouts and everything else stay untouched.

## Change (one file: `src/components/media/FeedCollage.tsx`)

Update `renderTile` so the `fit` is decided per-item type:

- If `item.type === 'video'` → `fit = 'contain'`
- Else (image) → `fit = 'cover'` (current behavior)

The existing `options.objectFit` override is no longer needed for the multi-item branches — all call sites (`count === 2`, `count === 3`, `count === 4+`) already call `renderTile(entry)` without specifying fit, so the per-type rule kicks in automatically. The overlay-count call for the 4th tile is preserved as-is.

Tile container already has `bg-muted`; switch the multi-item tile background to `bg-black` so letterbox bars match the single-media tile look and feel polished against both light/dark themes.

`FeedVideo` is called with `objectFit="contain"` for video tiles — it already accepts this prop (used today by single-media), so mute button, duration badge, click handling, and lightbox routing all continue to work unchanged.

## Not changed
- `SingleMediaTile` and `computeShape` (single-media sizing logic)
- Outer collage aspect ratios (`aspect-[16/9]`, `aspect-[4/3]` for two-portrait)
- Grid structure for 2 / 3 / 4+ tiles
- `FeedVideo` internals
- Composer, lightbox, upload pipeline
- Image tiles (still `object-cover`)

## Expected result
- Portrait video in a 3- or 4-tile collage → shown portrait, black side bars
- Landscape video in a collage → shown landscape, black top/bottom bars
- Images → still crop-fill their tiles cleanly
- Grid geometry identical to today; only the video fit mode and tile background change
