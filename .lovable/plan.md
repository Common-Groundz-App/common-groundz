## Goal

Match Twitter's sizing for single landscape images in the feed, without shrinking 4:3 / 3:2 photos.

## Twitter's measured values (wide 16:9 reference)

- Frame width: 518px
- Frame height: 292.89px (~16:9)

## Decision

Use a width-driven cap (`maxWidth: 518px`) with a height cap derived from the lower-clamp ratio (5:4), so every landscape ratio renders at the full 518px width:

- 518 / (5/4) = 414.4 → `maxHeight: 'min(414px, 70vh)'`

Wide 16:9 images still land at ~518 × 292 (matching Twitter); 4:3 lands at 518 × 389; 5:4 at 518 × 414. None get visually shrunk.

## Changes (scoped to `src/components/media/FeedCollage.tsx`)

### `computeShape` — landscape image branch
- `ratio: clamp(intrinsic, 5/4, 16/9)` — unchanged
- `maxWidth: '518px'` (new)
- `maxHeight: 'min(414px, 70vh)'` (was `'min(560px, 80vh)'`)
- `fit: 'cover'` — unchanged

### Placeholder branch — landscape hint
- Extend the existing `orientationHint === 'landscape'` placeholder to apply to images too.
- Video placeholder: 518 × 292 (16:9, tight Twitter frame).
- Image placeholder: 518 × 414 (16:9 ratio + loose height cap, matches final cap).

## Explicitly NOT changing

Portrait image (403×512), portrait video (287×508), landscape video (518×292), square media, multi-item collages, `FeedVideo.tsx`, composer, lightbox, upload pipeline, view tracking.
