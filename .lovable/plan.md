## Verdict

Yes — your diagnosis is stronger, and I would update the plan accordingly.

This should be treated as a **real-device mobile rendering/clipping issue**, not a state/visibility bug and not a media-dimensions problem.

## Why it shows in Chrome responsive mode but not on a real phone

Chrome desktop responsive mode matches viewport size, but it does **not** perfectly reproduce how a real mobile browser rasterizes and composites:

- **Hairline lines at the exact clipped edge are fragile on mobile.** A `0.5px` or edge-pinned track can disappear when it lands on a rounded, `overflow-hidden` boundary.
- **Video is often composited differently on real devices.** Mobile browsers, especially WebKit/iOS, handle `<video>` layers and overlays differently from desktop emulation.
- **Subpixel rounding is different.** On a desktop emulator, the line may still land on a visible device pixel; on a real phone it can be rounded/clipped away.
- **Single portrait videos are the most exposed case.** Their wrapper is tighter, so a scrubber pinned to `bottom: 0` has almost no interior buffer. In collage tiles, the geometry is different, so the bar remains visible.

So the most reliable fix is exactly what you suggested: **pull the scrubber slightly inside the frame and give it a stronger rendering floor on coarse-pointer devices**, without changing the media box itself.

## Updated implementation plan

### Scope
Only update `src/components/media/FeedVideo.tsx`.

No changes to:
- single-media sizing
- portrait dimensions
- `FeedCollage` layout
- object-fit behavior
- feed layout
- lightbox behavior
- backend / analytics

### Changes to make

1. **Move the bottom controls layer slightly inside the video frame**
   - Stop pinning the scrubber/control stack visually to the exact bottom edge.
   - Add a small inner bottom inset so the visible track sits safely inside the clipped rounded frame.
   - Keep the hit area large, but decouple the **touch target** from the **visible line position**.

2. **Give the controls/scrubber layer an explicit stacking order**
   - Add a reliable `z-index` above the video element so the overlay is never lost behind video compositing on mobile.
   - Keep pointer behavior exactly as now.

3. **Improve coarse-pointer/mobile rendering only**
   - On coarse-pointer devices, make the idle visible line slightly thicker (for example `h-1` / 2px equivalent).
   - Desktop keeps the current more delicate hairline feel.
   - Active state remains visually consistent with the current design.

4. **Keep the scrubber hit area large, but position the rendered track higher inside it**
   - Maintain the mobile-friendly seek target.
   - Ensure the visible line is centered within the hit zone and not sitting on the clipped boundary.

5. **Do not change the interaction model**
   - Idle: subtle progress only.
   - Active: controls on hover, focus, paused, scrubbing.
   - Play/mute/scrub interactions still stop propagation.
   - Video body tap still opens the lightbox.

## Recommended technical approach

### In `FeedVideo.tsx`

- Update the bottom overlay wrapper so it has:
  - a small inner bottom offset
  - explicit `z-index`
- Update the scrubber wrapper so:
  - the **visible track** is vertically centered inside the larger hit area
  - the track is not rendered at the exact clipped edge
- Add a mobile/coarse-pointer-only thickness adjustment for the idle track
- Leave all timing/state logic untouched unless required for layout cleanup

## Why I think this is the best fix

This solves the bug at the correct layer:
- not by changing content sizing
- not by changing collage behavior
- not by introducing device-specific logic in layout selection
- not by making the UI globally heavier on desktop

It directly addresses the likely failure mode: **edge clipping + subpixel rendering on real mobile video overlays**.

## Validation checklist

After implementation, verify:

- **Real mobile device:** single portrait video shows the idle progress line while playing
- **Real mobile device:** single portrait video shows the full scrubber when paused/scrubbing
- **Collage version of the same video:** unchanged
- **Desktop:** unchanged visual behavior
- **Play / mute / scrubber:** never open the lightbox
- **Tap on video body outside controls:** still opens the lightbox

## Fallback only if needed

If this still fails on a real device after the `FeedVideo.tsx` positioning fix, then the next step would be a very small wrapper adjustment in the single portrait path — but I would **not** start there. The first pass should stay in `FeedVideo.tsx` exactly as you proposed.