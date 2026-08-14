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

`maxLift` is **only** the trustworthy `shrinkPx`. There is no fallback: when `shrinkPx <= 0` the hook keeps observing and publishes no lift. A 540px speculative translation off an untrusted frame is worse than waiting a frame.

Applied only when all hold:
- `isMainComposerDocked === true`
- `window.visualViewport` exists
- shell rect is valid: finite, height > 0
- trustworthy `shrinkPx > 0`
- `overhang > 2px` (tolerance — sub-pixel noise never triggers a transform)
- not pinch-zoomed (`visualViewport.scale <= 1.01`)

Invalid geometry vs. valid zero — two distinct outcomes, decided in one place:
- **No valid measurement** (non-finite rect, zero height, missing `visualViewport`, `shrinkPx <= 0`): publish nothing, retain the current offset.
- **Valid measurement with no overhang**: publish `0`.

The pure helper returns a discriminated result (`{ kind: 'skip' }` | `{ kind: 'offset', px }`) so the hook never has to guess which case a `0` means.

Offset resets to 0 immediately on undock, on crossing to ≥1280px, on confirmed rotation, on pinch zoom, and on unmount. When the keyboard closes, `overhang` naturally returns to ~0 and the transform is dropped by the same formula.

Rotation reset uses the **same confirmed orientation signal** as `viewportKeyboard.ts`, not a raw `orientationchange` event: the keyboard hook surfaces its orientation label, the dock hook takes it as an input and zeroes the offset when it changes. The raw event only triggers a re-sample.

Style application:

```text
style={isMainComposerDocked && offsetPx > 0
  ? { transform: `translate3d(0, -${offsetPx}px, 0)` }
  : undefined}
```

No change to `bottom`, margins, padding, or spacer height.

## Coordinate-space check is a release gate, not just instrumentation

The formula assumes `shellRect.bottom` and `visualViewport.offsetTop + visualViewport.height` live in the same client coordinate space. jsdom tests only prove the arithmetic against mocked coordinates; they cannot validate WebKit. So the equation is **not final until the physical-device recording confirms it**.

Sequence:
1. Temporary instrumentation pass on the device: log `shellRect.bottom`, `visualViewport.height`, `offsetTop`, `scale`, `shrinkPx`, computed `overhang`, applied `offsetPx`, and the re-measured `shellRect.bottom` after the transform — across first focus, second focus, dismiss-key, and rotation.
2. The recorded geometry decides the `visualBottom` expression. If the two values are not in the same space, the equation is adjusted to the measured relationship before the change is considered done.
3. Acceptance either way: re-measurement reproduces the same correction, and first focus lands flush.
4. All instrumentation removed before completion — no debug UI, no feature flag, no committed logging.

## Where it lives

`src/utils/dockOffset.ts` — pure, React-free:
- `nextDockOffset({ uncorrectedBottom, visualBottom, maxLift, tolerancePx })` returning `{ kind: 'skip' }` for any non-finite input or `maxLift <= 0`, and `{ kind: 'offset', px }` for a valid measurement (`px === 0` when there is no overhang above tolerance).

`src/hooks/useDockedComposerOffset.ts`:
- Inputs: shell ref, `docked` boolean, `shrinkPx`, `orientation` label (the same confirmed label `viewportKeyboard` uses).
- Returns `offsetPx`.
- Keeps the applied offset in a ref so each sample compensates for it; observes for the whole docked session, but only publishes a lift once `shrinkPx > 0`.
- `skip` results retain the current offset; `offset` results publish it.
- Listeners: `visualViewport` `resize`/`scroll`, `window` `resize`/`orientationchange`, coalesced through one `requestAnimationFrame`, mounted guard, full cleanup.
- Late-geometry convergence on docking: next frame, the frame after, and one ~250ms follow-up. No `setInterval`; every pending frame and timeout cleared on cleanup and on undock.
- Zeroes the offset on undock, ≥1280px, zoom, and a changed confirmed orientation label.

`src/utils/viewportKeyboard.ts` — `reduceKeyboardState` additionally returns `shrinkPx` with **explicit trustworthy semantics**: a positive number only when the composer is active, unzoomed, the height sample is valid, and the baseline is present and orientation-matched. In every other case (inactive, zoomed, rotation-invalidated, missing baseline) it is `0`. Existing fields and behaviour unchanged.

`src/hooks/useSoftwareKeyboardOpen.ts` — surfaces `shrinkPx` and the resolved `orientation` alongside `status`/`open`.

`InlineCommentThread.tsx` — calls the new hook and applies the style on the docked wrapper. Nothing else changes.

## Tests

- `dockOffset` unit tests: no overhang → `offset 0`; partial overhang → positive; overhang above `maxLift` → clamped; negative and sub-tolerance overhang → `offset 0`; non-finite inputs and `maxLift <= 0` → `skip`.
- `viewportKeyboard.test.ts`: `shrinkPx` is positive only for trustworthy active samples; `0` for inactive, zoomed, rotation-invalidated and baseline-less cases.
- Hook tests in jsdom with stubbed `visualViewport` and a stubbed shell rect that **subtracts the applied transform on re-measure**, proving the fixed point: repeated samples keep the same offset instead of oscillating.
- Hook tests: no lift is published while `shrinkPx === 0` (regardless of status), and the lift lands on the first trustworthy sample of the same focus; invalid geometry retains the offset rather than clearing it; offset clears on undock, ≥1280px, zoom and orientation-label change; listeners, frames and timeouts all cleaned up on unmount.

## Manual verification on device

1. Cold-open a post, tap the comment input on the first try — composer sits flush above the keyboard, no gap, no flicker.
2. Dismiss with the keyboard-hide key and tap again — same result; the bottom nav returns on dismissal.
3. Type several lines so the composer grows — bar stays above the keyboard, spacer keeps pace.
4. Rotate with the keyboard open, then re-focus — no spurious lift.
5. Pinch-zoom while focused — no transform.
6. Desktop / ≥1280px — composer stays in flow, no transform, no behaviour change.
