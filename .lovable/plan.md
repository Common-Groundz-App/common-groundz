# Fix the docked comment composer disappearing on first focus (v3)

v3 keeps everything both reviews approved in v2 and adopts codex's four corrections. The key change: **no speculative lift**. Observation starts the moment the composer docks, but a transform is applied only once a *trustworthy* keyboard shrink exists. The 60%-of-viewport fallback is removed.

Where the reviews disagreed — whether to gate on `keyboardStatus === 'open'` — the resolution is the split codex proposed: docking starts *observation* immediately; the *transform* waits for trustworthy shrink, which arrives within the same focus (one or two frames, or the 250ms follow-up), never on a second tap. The idempotency fix from v2 stays: `uncorrectedBottom = measuredBottom + currentOffset`.

## What is happening

The docked composer uses `fixed inset-x-0 bottom-0` (`InlineCommentThread.tsx`, ~943-955) with no keyboard offset, relying on iOS Safari re-anchoring fixed elements to the keyboard-facing edge of the visual viewport. Safari does that only after the focus scroll settles. First focus on a not-yet-scrolled page: the bar is still anchored to the layout viewport bottom, behind the keyboard (screenshot 1). After a dismiss the viewport has settled, so the next focus lands correctly (screenshot 2).

This is a positioning bug, not a focus-state bug — the tab bar is hidden and the spacer is in place, so `isMainComposerActive` is true in both screenshots.

## The correction

Kept unchanged: the docking model (`fixed inset-x-0 bottom-0`), the spacer, focus regions, keyboard-dismiss blur, safe-area padding rule, reply/edit composers, and all comment behaviour. Added: a corrective `translate3d` on the docked wrapper only.

Self-correction-safe calculation, sampled every frame we observe:

```text
currentOffset     = offset currently applied to the shell
measuredBottom    = shellRect.bottom            // includes currentOffset
uncorrectedBottom = measuredBottom + currentOffset
visualBottom      = visualViewport.offsetTop + visualViewport.height
overhang          = uncorrectedBottom - visualBottom
nextOffset        = clamp(overhang, 0, maxLift)
```

Invariant, stated as the thing the tests assert: **re-measuring after the correction is applied must produce the same correction.** With compensation, `uncorrectedBottom` is stable, so `nextOffset` is a fixed point and there is no oscillation.

`maxLift`:
- trustworthy `shrinkPx` when available (see below);
- otherwise a conservative fallback of 60% of the layout viewport height, so a first-focus frame with no baseline yet can still be corrected without an unbounded lift.

Applied only when all hold:
- `isMainComposerDocked === true`
- `window.visualViewport` exists
- shell rect is valid: finite, height > 0
- `overhang > 2px` (tolerance — sub-pixel noise never triggers a transform)
- not pinch-zoomed (`visualViewport.scale <= 1.01`)

Offset resets to 0 immediately on undock, on crossing to ≥1280px, on confirmed rotation, on pinch zoom, and on unmount. When the keyboard closes, `overhang` naturally returns to ~0 and the transform is dropped by the same formula.

Style application:

```text
style={isMainComposerDocked && offsetPx > 0
  ? { transform: `translate3d(0, -${offsetPx}px, 0)` }
  : undefined}
```

No change to `bottom`, margins, padding, or spacer height.

## Coordinate-space verification before the formula is final

The formula assumes `shellRect.bottom` and `visualViewport.offsetTop + visualViewport.height` share the same client coordinate space. That is the expected behaviour but it is precisely the area whose iOS behaviour is under question, so implementation begins with a temporary instrumentation pass on the physical device: log `shellRect.bottom`, `visualViewport.height`, `offsetTop`, `scale`, computed `overhang`, applied `offsetPx`, and the re-measured `shellRect.bottom` after the transform, across first focus, second focus, dismiss-key, and rotation.

If the logs show the two values are *not* in the same space, the equation is adjusted to the measured relationship before the change is considered done — the invariant (re-measurement reproduces the same correction) is the acceptance test either way. All instrumentation is removed before completion; no debug UI, no feature flag, no committed logging.

## Where it lives

`src/utils/dockOffset.ts` — pure, React-free:
- `clampDockOffset({ uncorrectedBottom, visualBottom, maxLift, tolerancePx })` returning the next offset, ignoring non-finite inputs by returning the current offset's neutral value (0).

`src/hooks/useDockedComposerOffset.ts`:
- Inputs: shell ref, `docked` boolean, `keyboardStatus`, `shrinkPx`, `layoutHeight` source.
- Returns `offsetPx`.
- Keeps the applied offset in a ref so each sample can compensate for it, and samples for the whole docked session rather than only after `status === 'open'`.
- Listeners: `visualViewport` `resize`/`scroll`, `window` `resize`/`orientationchange`, coalesced through one `requestAnimationFrame`, mounted guard, full cleanup.
- Late-geometry convergence on docking: next frame, the frame after, and one ~250ms follow-up. No `setInterval`; every pending frame and timeout cleared on cleanup and on undock.
- Invalid or zero-height shell measurements are skipped, retaining the last good offset rather than snapping.

`src/utils/viewportKeyboard.ts` — `reduceKeyboardState` additionally returns `shrinkPx` with **explicit trustworthy semantics**: a positive number only when the composer is active, unzoomed, the height sample is valid, and the baseline is present and orientation-matched. In every other case (inactive, zoomed, rotation-invalidated, missing baseline) it is `0`, so stale shrink can never carry into a new viewport state. Existing fields and behaviour are unchanged.

`src/hooks/useSoftwareKeyboardOpen.ts` — surfaces `shrinkPx` alongside `status`/`open`.

`InlineCommentThread.tsx` — calls the new hook and applies the style on the docked wrapper. Nothing else changes.

## Tests

- `dockOffset` unit tests: no overhang, partial overhang, overhang above `maxLift`, negative overhang, sub-tolerance overhang, non-finite inputs.
- `viewportKeyboard.test.ts`: `shrinkPx` is positive only for trustworthy active samples; `0` for inactive, zoomed, rotation-invalidated and baseline-less cases.
- Hook tests in jsdom with stubbed `visualViewport` and a stubbed shell rect that **subtracts the applied transform on re-measure**, proving the fixed point: after correction, repeated samples keep the same offset instead of oscillating.
- Hook tests: correction applies while status is still `closed`/`unknown` on first focus; offset clears on undock, on ≥1280px, on zoom and on rotation; listeners, frames and timeouts all cleaned up on unmount.

## Manual verification on device

1. Cold-open a post, tap the comment input on the first try — composer sits flush above the keyboard, no gap, no flicker.
2. Dismiss with the keyboard-hide key and tap again — same result; the bottom nav returns on dismissal.
3. Type several lines so the composer grows — bar stays above the keyboard, spacer keeps pace.
4. Rotate with the keyboard open, then re-focus — no spurious lift.
5. Pinch-zoom while focused — no transform.
6. Desktop / ≥1280px — composer stays in flow, no transform, no behaviour change.
