# Dock correction from measured overhang (v6)

## My view: Codex is right on the physics, ChatGPT is right on the complexity

Codex's core objection holds and it kills the unconditional inset:

`innerHeight - visualViewport.height - visualViewport.offsetTop` is *always* about the keyboard height while the keyboard is open. It does not know whether the browser already anchored our `fixed` element above the keyboard. On the path that works today (keyboard-hide button, then re-focus) the composer is already correct, so adding a keyboard-height `bottom` would lift it a further ~300px into the middle of the screen. One formula cannot serve both observed states.

ChatGPT is right that v4's full apparatus — `dockOffset.ts`, `useDockedComposerOffset.ts`, `shrinkPx` positioning, 250ms convergence sampling — is more machinery than this needs.

So v6 takes Codex's *adaptive measurement* and ChatGPT's *minimal surface*: measure the actual overhang once per settled frame and apply it to the same `bottom` property we already use. No transform layer, no second positioning system, no speculative keyboard-height math.

## The model

```text
main composer active + below 1280px + keyboardStatus === 'open'
    -> dock: fixed inset-x-0, bottom: <correctionPx>   (correction starts at 0)

while docked and status is 'open', each settled frame:
    visualBottom      = visualViewport.offsetTop + visualViewport.height
    uncorrectedBottom = shellRect.bottom + currentCorrectionPx   // undo what we applied
    overhang          = uncorrectedBottom - visualBottom
    correction        = overhang > TOLERANCE ? clamp(overhang) : 0
```

- Already anchored correctly (the keyboard-button path): `overhang <= TOLERANCE` -> correction stays `0` -> behaviour identical to today. No double-count, by construction.
- Left behind the keyboard (the tap-to-dismiss path): `overhang` is positive -> correction is exactly the measured gap, nothing more.

`uncorrectedBottom` adding `currentCorrectionPx` back is what makes the calculation idempotent: `getBoundingClientRect()` already reflects the applied correction, so without that term the value would oscillate. This is a fixed point — once correct, re-running produces the same number.

`TOLERANCE` is 2px (sub-pixel rect noise). `clamp` bounds the correction to `[0, visualViewport.height * 0.6]` so a bogus measurement can never fling the bar off-screen, and returns "no change" rather than `0` for untrustworthy frames.

## Implementation

- **`src/utils/dockCorrection.ts`** (new, pure):
  `nextDockCorrection({ shellBottom, visualOffsetTop, visualHeight, scale, currentCorrection, keyboardStatus })` returning a discriminated result — `{ kind: 'skip' }` or `{ kind: 'correction', px }`. `skip` (leave the current value untouched, never reset to 0) when: status is not `'open'`, `scale > 1.01`, any input non-finite, or `visualHeight <= 0`. Otherwise the clamped fixed-point value above.
- **`src/hooks/useDockCorrection.ts`** (new): given `{ enabled, keyboardStatus, shellRef }`, subscribes to `visualViewport` `resize`/`scroll` and `window` `resize`/`orientationchange`, coalesced through a single `requestAnimationFrame`; reads the rect inside the frame; stores the correction in state via a ref-held current value so it never depends on stale props. Resets to `0` when `enabled` goes false (undocking) and on unmount. Zero listeners when `enabled` is false, so desktop and in-flow states run nothing.
- **`src/components/comments/InlineCommentThread.tsx`**: keep `shouldDockMainComposer` and the Stage 1 gate exactly as shipped; keep the spacer, the region ref composition, safe-area padding rule and `z-50` tier; while docked, replace the static `bottom-0` class with `style={{ bottom: `${correction}px` }}` (0 on first docked commit, so the initial paint matches today's).

Two settled samples are enough in practice (the `resize` that confirms the keyboard, plus the following `scroll`); if device testing shows iOS publishes geometry a frame later than both, we add *one* extra `requestAnimationFrame` re-sample — not a timeout ladder.

## Explicitly not doing

- Unconditional `bottom: keyboardInset` (double-counts on the working path).
- `translate3d` correction — the same math, but a second positioning mechanism layered over `bottom`; correcting the property we already control is simpler and equally adaptive.
- `shrinkPx`-derived positioning, the 250ms convergence follow-up, `dockOffset.ts`, `useDockedComposerOffset.ts`.
- Delayed `scrollIntoView` (fights iOS's own focus scroll, hard-codes an animation duration).
- `interactive-widget=resizes-content` (app-wide viewport policy change for one component).

## Unchanged

Stage 1 docking gate, spacer behaviour, keyboard-dismiss blur hook, reply/edit composers, mention popover tier, safe-area padding rule, 1280px breakpoint, comment submission, auth gating, layout widths and padding.

## Tests

`dockCorrection.test.ts`:
- already flush -> `correction 0`; overhang below tolerance -> `0`.
- overhang of 300px with no current correction -> `300`.
- **fixed point:** feeding the corrected rect back (`shellBottom` reduced by the applied correction, `currentCorrection` set) returns the same value.
- status `closed`/`unknown` -> `skip` (does not clear a good correction).
- zoomed, non-finite, zero-height viewport -> `skip`.
- overhang beyond 60% of viewport height -> clamped.

`useDockCorrection.test.tsx`:
- recomputes on `visualViewport` resize and scroll; multiple events coalesce into one frame.
- no listeners and correction `0` when disabled; resets to `0` when `enabled` flips false.
- all listeners removed and pending frame cancelled on unmount.

Docking-condition suite (`composerDocking.test.ts`) stays as-is.

## Device verification (iOS Chrome and Safari)

1. Cold-open a post, tap the input once — composer flush above the keyboard.
2. **Tap the page to dismiss, tap the input again** — still flush (today's failing case).
3. Dismiss with the keyboard-hide key, tap again — still flush, and **no extra gap** (the double-count check).
4. Bottom nav returns after every dismissal.
5. Multi-line typing — composer tracks the keyboard, spacer keeps pace.
6. Scroll the page with the keyboard open — composer stays glued.
7. Rotate with the keyboard open — re-anchors, no stray gap or lift.
8. Pinch-zoom while focused — no misplacement.
9. Desktop / >=1280px — unchanged.

Temporary console instrumentation (`shellRect.bottom`, `visualViewport.offsetTop + height`, computed overhang, applied correction) during the device pass only, removed before the change is considered complete.
