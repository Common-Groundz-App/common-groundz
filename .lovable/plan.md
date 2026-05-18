## Goal

Move the scrubber/control layer slightly higher on real mobile so it sits comfortably inside the single portrait video frame, away from the rounded bottom edge.

## Scope

- Only `src/components/media/FeedVideo.tsx`.
- No changes to FeedCollage, portrait dimensions, object-fit, feed layout, or interaction/lightbox logic.

## Change

In the bottom controls wrapper (currently `bottom-1 [@media(pointer:coarse)]:bottom-3 z-20`), bump the coarse-pointer inset from `bottom-3` (≈12px) to `bottom-4` (16px):

`bottom-1 [@media(pointer:coarse)]:bottom-4 z-20`

That's the only edit.

## Why this works

The previous 12px inset cleared the rounded corner but the scrubber still reads as edge-hugging on real devices. 16px gives an extra ~4px of breathing room, making the placement feel intentional and visually consistent with the controls row above it, while staying subtle. Desktop is untouched because the rule is gated behind `@media(pointer:coarse)`.

## What stays the same

- Desktop `bottom-1` (4px) unchanged.
- Track thickness, thumb size, hit area, idle vs active opacity — unchanged.
- stopPropagation on play/mute/scrub; tap on video body still opens the lightbox.
- Collage videos unchanged.

## Validation

- Real mobile, single portrait: scrubber sits clearly inside the frame with visible margin below.
- Desktop: visually identical.
- Collage: unchanged.
- Play/mute/scrub: do not open lightbox. Video body tap: opens lightbox.

## Fallback

If 16px ends up looking too high on shorter portrait videos, drop to `bottom-3.5` (14px). Unlikely to be needed.
