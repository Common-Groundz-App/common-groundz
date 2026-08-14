# Adaptive measured-overhang dock correction (v7)

Both reviews agree on the principle, and v7 accepts every substantive point: adaptive measured overhang, immediate measurement on enable, a shrink-bounded clamp, explicit reset semantics, and correction applied as a transform.

## The model

```text
main composer active + below 1280px + keyboardStatus === 'open'
    -> dock: fixed inset-x-0 bottom-0, transform: translate3d(0, -<correction>px, 0)

while docked and status is 'open':
    visualBottom      = visualViewport.offsetTop + visualViewport.height
    uncorrectedBottom = shellRect.bottom + currentCorrectionPx
    overhang          = uncorrectedBottom - visualBottom
    correction        = overhang > 2 ? min(overhang, trustworthyShrinkPx) : 0
```

- Keyboard-hide-button path (works today): overhang ~0 -> correction 0 -> byte-identical to current behaviour, no double-lift.
- Tap-to-dismiss path (fails today): positive overhang -> bounded correction equal to the measured gap.

Adding `currentCorrectionPx` back is what makes this a fixed point: the measured rect already reflects the applied lift, so re-running returns the same number instead of oscillating.

## Changes adopted from the reviews

### 1. Transform, not `bottom` (ChatGPT)
`bottom: 0` stays; the correction is `transform: translate3d(0, -px, 0)`. Compositor-only, leaves the docking model and any other positioned-geometry reasoning untouched. Codex accepts either; the math is unchanged.

### 2. Measure immediately when docking becomes enabled (Codex — required)
The hook only becomes enabled *after* `keyboardStatus` flips to `open`, by which point the viewport events that opened the keyboard have already fired. Subscribing to future events alone could leave the correction at 0 until the user scrolls — reproducing the bug. So:

- measure synchronously in a `useLayoutEffect` on the enable transition, before paint;
- schedule exactly one follow-up `requestAnimationFrame` sample for late-published iOS geometry;
- then rely on the event subscription.

No timeout ladder, no 250ms follow-up.

### 3. Clamp by classified shrink, not 60% of viewport height (Codex — required)
`viewportKeyboard.ts` already owns a validated pre-keyboard baseline with orientation, zoom and activity gating. Surface `shrinkPx = baseline - visualHeight` (0 when untrustworthy or no baseline) through `useSoftwareKeyboardOpen`, and use it as the maximum correction. The bound is then grounded in the same measurement that authorised docking, instead of an arbitrary fraction that could be too generous in portrait and too tight in landscape.

### 4. Explicit reset semantics (Codex)
Correction resets to `0` on: undock, `keyboardStatus` leaving `open`, crossing to >=1280px, zoom, orientation-label change, region deactivation, and unmount. Invalid geometry *within* a still-valid open session returns `skip` and retains the last good correction; an invalidated session resets rather than preserving a stale lift. The correction ref is updated alongside the state write so a rapid next sample never compensates with a stale value.

## Implementation

- **`src/utils/viewportKeyboard.ts`** — add `shrinkPx` to the reduce result (0 unless active, unzoomed, valid height, baseline present in the same orientation). Baseline mutation rules unchanged.
- **`src/hooks/useSoftwareKeyboardOpen.ts`** — return `{ status, open, shrinkPx, orientation }`; `open` stays derived from `status`.
- **`src/utils/dockCorrection.ts`** (new, pure) — `nextDockCorrection({ shellBottom, visualOffsetTop, visualHeight, scale, currentCorrection, shrinkPx, keyboardStatus })` returning `{ kind: 'skip' }` or `{ kind: 'correction', px }`. `skip` when status is not `'open'`, `scale > 1.01`, `visualHeight <= 0`, or any input is non-finite. Tolerance 2px, clamp `[0, shrinkPx]`.
- **`src/hooks/useDockCorrection.ts`** (new) — `{ enabled, keyboardStatus, shrinkPx, orientation, shellRef }`; layout-effect sample on enable + one rAF follow-up; `visualViewport` `resize`/`scroll` and window `resize`/`orientationchange`, coalesced through a single rAF; ref-held current correction; resets to 0 and cancels pending frames when disabled, when orientation changes, and on unmount; zero listeners while disabled.
- **`src/components/comments/InlineCommentThread.tsx`** — keep `shouldDockMainComposer`, the spacer, region ref composition, safe-area rule, `z-50` and `bottom-0` as shipped; add `style={{ transform: correction ? `translate3d(0, -${correction}px, 0)` : undefined }}` on the docked shell only.

## Explicitly not doing

Unconditional `bottom: keyboardInset`; `shrinkPx` as a *positioning* value (it is only a clamp); the 250ms convergence follow-up; delayed `scrollIntoView`; `interactive-widget=resizes-content`; any change to comment submission, reply/edit composers, mentions, auth gating, spacer semantics, layout widths, or the 1280px breakpoint.

## Tests

`dockCorrection.test.ts`:
- already flush -> 0; sub-tolerance noise -> 0; negative overhang -> 0.
- behind keyboard -> positive correction equal to the overhang.
- overhang greater than `shrinkPx` -> clamped to `shrinkPx`; `shrinkPx` 0 -> correction 0.
- **fixed point:** corrected rect fed back with `currentCorrection` set returns the same value.
- status `closed`/`unknown` -> `skip`; zoomed, non-finite, zero-height viewport -> `skip`.

`useDockCorrection.test.tsx`:
- enabling produces an immediate sample with no viewport event, and the follow-up frame yields the same value.
- `resize` + `scroll` in one frame -> one calculation.
- disable, status leaving `open`, orientation change -> correction 0.
- unmount -> listeners removed, pending frame cancelled, no late callbacks.

`viewportKeyboard.test.ts` — `shrinkPx` present when open, 0 when inactive/zoomed/rotated/no baseline. `composerDocking.test.ts` unchanged.

## Device verification (release gate)

Temporary console instrumentation records, for both paths, `shellRect.bottom`, `currentCorrection`, reconstructed `uncorrectedBottom`, `visualViewport.offsetTop + height`, `shrinkPx`, and the applied correction:

- Path A (keyboard-hide button -> refocus): overhang ~0, correction 0.
- Path B (tap page to blur -> refocus): positive overhang, bounded positive correction.

If both paths report the same overhang despite visibly different positions, the coordinate equation is wrong and must be corrected from the recorded geometry before release.

Then: 1) cold-open, tap input once -> flush; 2) tap page to dismiss, tap again -> flush (today's failure); 3) keyboard-hide key, tap again -> flush with no extra gap; 4) bottom nav returns after every dismissal; 5) multi-line typing keeps the composer visible; 6) scroll with the keyboard open -> stays glued; 7) rotate with the keyboard open -> no gap or stray lift; 8) pinch-zoom -> no misplacement; 9) desktop/>=1280px unchanged.

All instrumentation is removed before the change is considered complete.
