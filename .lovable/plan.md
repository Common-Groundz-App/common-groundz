# Fix the docked comment composer disappearing on first focus (v5)

The review is right, and v5 adopts it: try the timing fix first, and only fall back to v4's measurement-and-transform system if physical-device testing proves it insufficient.

The symptom — first focus fails, every later focus succeeds — is the signature of a race, not a coordinate-space bug. Today the composer detaches to `fixed` the instant the textarea is focused (`InlineCommentThread.tsx:131`), so Safari runs its native focus scroll against an element that React has already moved to the layout-viewport bottom. Compensating for that with a transform treats a self-inflicted race as a browser geometry problem.

## Stage 1 (implement now): dock only after the keyboard is confirmed open

`InlineCommentThread` already reads `keyboardStatus` from `useSoftwareKeyboardOpen` (line 128) purely for safe-area padding. Add it to the docking condition:

```text
const isMainComposerDocked =
  isMainComposerActive && viewportBelowXl && keyboardStatus === 'open';
```

Resulting sequence:

```text
focus            → composer stays in flow
Safari           → performs its normal focus scroll, geometry settles
visual viewport  → reports keyboard-sized shrink
keyboardStatus   → 'open'
composer         → switches to fixed inset-x-0 bottom-0, flush above the keyboard
```

This is one existing state value added to one existing derived boolean. Nothing else changes: docking model, spacer, focus regions, keyboard-dismiss blur, safe-area padding rule, reply/edit composers, mention popover tier, 1280px breakpoint, and all comment behaviour stay exactly as shipped.

Two properties worth noting as intended, not regressions:
- With a hardware/Bluetooth keyboard (or accessibility input) the composer now stays in flow, because no software keyboard is ever confirmed. That is the correct behaviour.
- The spacer only renders while docked, and the shell is already measured in flow from mount via `ResizeObserver`, so the first docked commit still has a valid height. No spacer-without-bar or bar-without-spacer state is possible — both still key off the single `isMainComposerDocked` flag.

### Tests for Stage 1

- Docking flag derivation: docked only when active + below 1280px + status `open`; not docked for status `closed` or `unknown`, above the breakpoint, or when inactive.
- Transition test: active + `unknown` renders the composer in flow with no spacer; when status flips to `open` the fixed classes and the spacer appear in the same commit.
- Undock on status leaving `open` returns the composer to flow and unmounts the spacer.
- Guests never dock (unchanged).

### Device verification for Stage 1 (the decisive test)

1. Cold-open a post, tap the comment input once — composer stays in flow during the keyboard animation, then lands flush above the keyboard with no gap and no visible jump.
2. Dismiss with the keyboard-hide key and tap again — same result; the bottom nav returns on dismissal.
3. Type several lines — bar stays above the keyboard, spacer keeps pace.
4. Rotate with the keyboard open, then re-focus — composer docks correctly, no stray padding.
5. Pinch-zoom while focused — no misplacement.
6. Desktop / ≥1280px — composer stays in flow, unchanged.

If steps 1 and 2 pass consistently, the work is done. We do **not** add `dockOffset.ts`, `useDockedComposerOffset.ts`, transform reconstruction, `shrinkPx` for positioning, or the 250ms convergence follow-up.

## Stage 2 (fallback only, if Stage 1 provably fails)

Only if the composer still lands behind the keyboard *after* `keyboardStatus` is conclusively `open` do we implement the v4 transform correction, and only using geometry recorded on the failing device. Its safeguards remain the right ones and are carried forward verbatim if we get there:

- confirmed-open gate; trustworthy `shrinkPx` clamp with no speculative viewport-percentage lift
- idempotent calculation (`uncorrectedBottom = measuredBottom + currentOffset`) with a fixed-point invariant asserted by tests
- discriminated `{ kind: 'skip' | 'offset' }` result so invalid geometry never clears a good offset
- independent confirmed-orientation signal, zoom reset, bounded convergence samples, full listener/frame/timeout cleanup
- physical coordinate verification (`shellRect.bottom` vs `visualViewport.offsetTop + visualViewport.height`) as a release gate, with all instrumentation removed before completion

Sequencing rule taken from the review: do not ship status-gated docking and transform correction together. Once docking happens after the viewport settles, the measured overhang may already be zero — adding both at once would leave us unable to tell which change mattered.

## Files touched in Stage 1

- `src/components/comments/InlineCommentThread.tsx` — one-line change to `isMainComposerDocked`, plus a comment recording why docking waits for confirmed-open.
- A docking-condition test suite (new file alongside the existing comment tests), registered in `vitest.config.ts`'s `dom` include list.

No changes to `viewportKeyboard.ts`, `useSoftwareKeyboardOpen.ts`, or any new utility module.
