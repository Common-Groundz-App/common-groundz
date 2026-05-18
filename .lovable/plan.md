## Goal

Move the visible scrubber track and thumb higher inside the video frame on real mobile so they are fully visible above the rounded/clipped bottom edge. Desktop and collage behavior stay unchanged.

## Scope

- Only `src/components/media/FeedVideo.tsx`.
- No changes to `FeedCollage`, single portrait dimensions, object-fit, or feed layout.
- No changes to interaction/lightbox logic.

## Changes

1. **Increase bottom inset on coarse-pointer devices.**
   - Current bottom controls wrapper uses `bottom-1` (4px) for all devices.
   - Change to: `bottom-1 [@media(pointer:coarse)]:bottom-3` (≈12px on mobile, unchanged 4px on desktop).
   - This shifts both the controls row and the scrubber strip up together so the visible track and thumb sit clearly inside the rounded frame.

2. **Keep hit area large; only the rendered position shifts.**
   - `VideoProgressBar`'s outer `h-3` hit area, thumb size, and pointer logic stay identical.
   - The 3px thumb that currently peeks at the edge will now be fully above the bottom curve on mobile.

3. **Preserve all other behavior.**
   - `z-20`, idle vs active opacity, coarse-pointer thicker idle line, stopPropagation on play/mute/scrub, tap-to-lightbox on video body — all unchanged.

## Why this works

The previous fix gave only 4px of inset, which on real mobile (after subpixel rounding + rounded-corner clipping on a tight portrait frame) leaves the thumb sitting on the clipped boundary. ~12px of inset is enough buffer to clear the rounded corner radius and any device-side compositing rounding, while remaining visually subtle. Desktop keeps the tighter 4px feel because the change is gated behind `@media(pointer:coarse)`.

## Validation

- Real mobile, single portrait video playing → subtle progress line clearly visible, not on the edge.
- Real mobile, paused/scrubbing → full track + thumb fully visible above the rounded bottom.
- Collage videos: unchanged.
- Desktop: visually unchanged.
- Play / mute / scrub: still do not open the lightbox.
- Tap on video body: still opens the lightbox.
