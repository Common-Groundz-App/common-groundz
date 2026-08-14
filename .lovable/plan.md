# Fix the docked comment composer disappearing on first focus (v4)

v4 adds the last safety gate: a positive transform is applied **only while `keyboardStatus === 'open'`**. v3 gated on `shrinkPx > 0`, but a positive shrink is not proof of a keyboard — browser-toolbar movement produces one too. Observation still starts the instant the composer docks, so convergence is unchanged: once the visual viewport reports the keyboard-sized shrink during the *same* focus, status flips to `open` and the correction applies. No second tap.

Clean separation of the three concepts:
- `shrinkPx` — **measurement**: `max(0, baseline - visualHeight)`, viewport shrink, not necessarily keyboard.
- `keyboardStatus` — **classification**: whether that shrink clears the keyboard threshold.
- `offsetPx` — **positioning correction**: permitted only by confirmed classification.

Everything else from v3 stands: no 60vh fallback, discriminated skip/offset result, confirmed-orientation reset, and the idempotency fix `uncorrectedBottom = measuredBottom + currentOffset`.

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

`maxLift` is **only** `shrinkPx` measured in a confirmed-open frame. There is no fallback: no trustworthy maximum means no lift. A large speculative translation off an untrusted frame is worse than waiting a frame.

Applied only when all hold:
- `isMainComposerDocked === true`
- `keyboardStatus === 'open'` — confirmed software keyboard, not toolbar movement or a hardware keyboard
- `window.visualViewport` exists
- shell rect is valid: finite, height > 0
- `shrinkPx > 0`
- `overhang > 2px` (tolerance — sub-pixel noise never triggers a transform)
- not pinch-zoomed (`visualViewport.scale <= 1.01`)

Sequence, stated as the model to implement:

```text
docked                                      → observe immediately
closed / unknown                            → collect samples, schedule convergence, no lift
open + shrinkPx > 0 + measured overhang     → apply idempotent bounded correction
closed, unknown, zoomed, rotated,
  undocked, or >=1280px                     → clear correction
```

Invalid geometry vs. valid zero — two distinct outcomes, decided in one place:
- **No valid measurement** (non-finite rect, zero height, missing `visualViewport`): publish nothing, retain the current offset.
- **Valid measurement with no overhang, or status not `open`**: publish `0`.

The pure helper returns a discriminated result (`{ kind: 'skip' }` | `{ kind: 'offset', px }`) so the hook never has to guess which case a `0` means: `skip` protects a valid offset from an invalid sample, `offset: 0` is a genuine recovery to no correction.

Offset resets to 0 immediately on undock, on crossing to ≥1280px, on confirmed rotation, on pinch zoom, on status leaving `open`, and on unmount.

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
1. Temporary instrumentation pass on the device: log `shellRect.bottom`, `visualViewport.height`, `offsetTop`, `scale`, `shrinkPx`, `keyboardStatus`, computed `overhang`, applied `offsetPx`, and the re-measured `shellRect.bottom` after the transform — across first focus, second focus, dismiss-key, and rotation.
2. The recording must demonstrate all of: first failing focus yields a positive overhang; a correct second focus yields ~0; applying the transform makes the bar visually flush; re-measuring reproduces the same offset; dismissal/undock returns to 0; toolbar movement without an open keyboard produces no positive transform; pinch zoom and rotation clear the transform; multi-line growth does not change the bottom-edge correction.
3. The recorded geometry decides the `visualBottom` expression. If the two values are not in the same space on the affected iOS version, the equation is adjusted to the measured relationship before the change is considered done.
4. All instrumentation removed before completion — no debug UI, no feature flag, no committed logging.

## Where it lives

`src/utils/dockOffset.ts` — pure, React-free:
- `nextDockOffset({ uncorrectedBottom, visualBottom, maxLift, tolerancePx })` returning `{ kind: 'skip' }` for any non-finite input, and `{ kind: 'offset', px }` for a valid measurement (`px === 0` when there is no overhang above tolerance or `maxLift <= 0`).

`src/hooks/useDockedComposerOffset.ts`:
- Inputs: shell ref, `docked` boolean, `keyboardStatus`, `shrinkPx`, `orientation` label (the same confirmed label `viewportKeyboard` uses).
- Returns `offsetPx`.
- Keeps the applied offset in a ref so each sample compensates for it; observes for the whole docked session, but publishes a positive lift only while `keyboardStatus === 'open'`.
- `skip` results retain the current offset; `offset` results publish it.
- Listeners: `visualViewport` `resize`/`scroll`, `window` `resize`/`orientationchange`, coalesced through one `requestAnimationFrame`, mounted guard, full cleanup.
- Late-geometry convergence on docking: next frame, the frame after, and one ~250ms follow-up. No `setInterval`; every pending frame and timeout cleared on cleanup and on undock.
- Zeroes the offset on undock, ≥1280px, zoom, status leaving `open`, and a changed confirmed orientation label.

`src/utils/viewportKeyboard.ts` — `reduceKeyboardState` additionally returns `shrinkPx = max(0, baseline - visualHeight)`, documented as **viewport shrink, not keyboard shrink**: positive only when the composer is active, unzoomed, the height sample is valid, and the baseline is present and orientation-matched; `0` in every other case. Whether it constitutes an open keyboard remains `keyboardStatus`'s job. Existing fields and behaviour unchanged.

`src/hooks/useSoftwareKeyboardOpen.ts` — surfaces `shrinkPx` and the resolved `orientation` alongside `status`/`open`.

`InlineCommentThread.tsx` — calls the new hook and applies the style on the docked wrapper. Nothing else changes.

## Tests

- `dockOffset` unit tests: no overhang → `offset 0`; partial overhang → positive; overhang above `maxLift` → clamped; negative and sub-tolerance overhang → `offset 0`; `maxLift <= 0` → `offset 0`; non-finite inputs → `skip`.
- `viewportKeyboard.test.ts`: `shrinkPx` is positive only for valid active unzoomed baseline-matched samples; `0` for inactive, zoomed, rotation-invalidated and baseline-less cases; a toolbar-sized shrink yields a positive `shrinkPx` while `keyboardStatus` stays `closed`.
- Hook tests in jsdom with stubbed `visualViewport` and a stubbed shell rect that **subtracts the applied transform on re-measure**, proving the fixed point: repeated samples keep the same offset instead of oscillating.
- Hook tests: no lift while status is `closed`/`unknown` even with a positive `shrinkPx` (the toolbar case); the lift lands on the first `open` sample of the same focus session without a second focus; invalid geometry retains the offset rather than clearing it; offset clears on undock, ≥1280px, zoom, status leaving `open`, and orientation-label change; listeners, frames and timeouts all cleaned up on unmount.

## Manual verification on device

1. Cold-open a post, tap the comment input on the first try — composer sits flush above the keyboard, no gap, no flicker.
2. Dismiss with the keyboard-hide key and tap again — same result; the bottom nav returns on dismissal.
3. Type several lines so the composer grows — bar stays above the keyboard, spacer keeps pace.
4. Rotate with the keyboard open, then re-focus — no spurious lift.
5. Pinch-zoom while focused — no transform.
6. Desktop / ≥1280px — composer stays in flow, no transform, no behaviour change.
