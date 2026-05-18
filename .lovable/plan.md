## Verdict

Yes — your direction is correct and this is achievable. ChatGPT's reasoning matches what the git history actually shows. Phase 1 only undid the *later* `bottom-3 / bottom-4 / z-20 / coarse-pointer h-1` additions. One piece of the **first** global mobile fix is still in the file and needs to come out before we start Phase 2.

## What the git history shows

I traced every revision of `src/components/media/FeedVideo.tsx`:

| Commit | line 145 (track height) | line 476 (controls wrapper) | Meaning |
|---|---|---|---|
| `05c8ab17` | `h-0.5` | `absolute inset-x-0 bottom-0 pointer-events-none` | **A. True original scrubber** |
| `0a718d34` | `h-0.5` | `... bottom-1 z-20 ...` | **B. First global mobile fix** (added `bottom-1` + `z-20`) |
| `7460a5e9` | `h-0.5 [@media(pointer:coarse)]:h-1` | `... bottom-1 z-20 ...` | B continued (coarse-pointer thickness) |
| `833483ac` / `b3f71767` / `5ed66e83` | same | `... bottom-1 [@media(pointer:coarse)]:bottom-3/4 z-20 ...` | **C. Later bottom-3 / bottom-4 tweak** |
| `499cec39` (current) | `h-0.5` ✓ | `absolute inset-x-0 bottom-1 pointer-events-none` | Phase 1 removed C and the coarse-pointer h-1, but **`bottom-1` from B is still here** |

So classification:
- **A (keep):** original scrubber feature, `h-0.5` idle, `h-1` active, `bottom-0`, all play/pause/mute/seek logic.
- **B (remove):** `bottom-1` on the controls wrapper, the coarse-pointer `h-1` idle override, the `z-20`. Of these, only `bottom-1` is still in the file.
- **C (remove):** `[@media(pointer:coarse)]:bottom-3 / bottom-4`. Already gone.

## The change

Single edit in `src/components/media/FeedVideo.tsx`, line 476:

```diff
- 'absolute inset-x-0 bottom-1 pointer-events-none',
+ 'absolute inset-x-0 bottom-0 pointer-events-none',
```

That's the only remaining piece of the first global mobile clipping fix. After this, `FeedVideo.tsx` matches the original scrubber baseline (`05c8ab17`) byte-for-byte in the scrubber-related lines.

## What stays untouched

- The entire `VideoProgressBar` component (hit area, pointer logic, keyboard seek, thumb).
- Play / pause / mute buttons, time display, gradient backdrop.
- `isActive` visibility logic, auto-hide timer, scrubbing state.
- `FeedCollage`, video dimensions, `objectFit`, lightbox, analytics.
- No new props, no device detection, no conditional styling.

## Expected result

- Collage videos: identical to the true original.
- Single landscape videos: identical to the true original.
- Desktop: unchanged.
- Single portrait video on real mobile: original bug may return (scrubber clipped at the rounded edge). That is acceptable — Phase 2 will fix it with a targeted `controlInsetVariant="single-portrait"` prop from `FeedCollage`'s `SingleMediaTile`, applied only to that one path.

## Phase 2 (not part of this step, for reference)

Once you confirm this baseline on a real device, Phase 2 will:
1. Add a `controlInsetVariant?: 'default' | 'single-portrait'` prop to `FeedVideo`.
2. From `FeedCollage`'s `SingleMediaTile`, pass `"single-portrait"` only when the single media is a portrait video.
3. In `FeedVideo`, when that variant is set **and** on coarse-pointer devices, apply the inner bottom inset and thicker idle line — scoped to that one case only.

No other code paths get touched.
