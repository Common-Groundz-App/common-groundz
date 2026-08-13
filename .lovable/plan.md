# Fix the docked comment composer disappearing on first focus

## What is happening

The docked composer is positioned with `fixed inset-x-0 bottom-0` (`InlineCommentThread.tsx`, lines ~943-955) with no keyboard offset. That relies on iOS Safari re-anchoring fixed elements to the keyboard-facing edge of the *visual* viewport.

Safari does that only after it has settled the focus scroll. On the **first** focus of a page that was not yet scrolled, the bar is still anchored to the bottom of the **layout** viewport, which is now behind the keyboard — screenshot 1: keyboard open, no composer anywhere. After you dismiss the keyboard, the page has been scrolled/settled, so the second focus lands with fixed already anchored above the keyboard — screenshot 2, the behaviour we want.

So this is not a state-machine bug (`isMainComposerActive` is clearly true — the tab bar is hidden and the spacer is in place); it is a positioning bug: `bottom: 0` is trusted to mean "above the keyboard", and on the first focus it does not.

## The fix: measure the gap instead of assuming it

Rather than hard-coding either `bottom: 0` (breaks case 1) or `bottom: keyboardHeight` (double-counts on browsers that already re-anchor, which earlier evidence showed happens for `BottomNavigation`), the docked bar corrects itself from a measurement:

```text
visualBottom = visualViewport.offsetTop + visualViewport.height   // layout/client coords
overhang     = shellRect.bottom - visualBottom
offset       = clamp(overhang, 0, keyboardShrink)                  // px to lift the bar
```

- If Safari already anchored the bar above the keyboard, `overhang` is ~0 and nothing changes — identical to today's correct case.
- If the bar is sitting behind the keyboard, `overhang` equals the covered amount and the bar is lifted by exactly that much.
- Clamped at 0 (never pushed down) and at the measured keyboard shrink (never lifted more than a keyboard height), so a bad frame cannot run away.

Applied as `transform: translateY(-offset)` on the docked wrapper — compositor-only, no reflow, and it does not disturb the `fixed`/flow class logic or the spacer.

## Where it lives

A new hook, `src/hooks/useDockedComposerOffset.ts`, keeps the geometry out of the component:

- Input: the shell element ref, whether the composer is docked, and the keyboard status/shrink already produced by `useSoftwareKeyboardOpen`.
- Returns `offsetPx: number` (0 when not docked, when `visualViewport` is missing, or while pinch-zoomed).
- Samples on `visualViewport` `resize`/`scroll`, `window` `resize`/`orientationchange`, coalesced through one `requestAnimationFrame`, with a mounted guard and full listener cleanup — same lifecycle discipline as the existing keyboard hook.
- Because iOS reports viewport geometry late, docking also triggers a short re-sample sequence (a couple of animation frames plus one ~250ms follow-up, cleared on cleanup) so the first focus converges without waiting for a user gesture. No `setInterval`.
- Ignores samples where the shell has no box (height 0) or the values are non-finite, keeping the previous offset instead of snapping to 0.

`useSoftwareKeyboardOpen` gains one extra returned field, `shrinkPx` (baseline minus current visual height, 0 when unknown), so the clamp uses the same numbers the classifier already computes. `viewportKeyboard.ts` returns it from `reduceKeyboardState` — a pure addition, existing behaviour and tests unchanged.

`InlineCommentThread.tsx` changes only in the docked wrapper: it calls the new hook and applies `style={{ transform: ... }}` while `isMainComposerDocked`. No change to the spacer, the focus regions, the safe-area padding rule, or the reply/edit composers.

## Tests

- Pure clamp helper (`clampDockOffset`) unit-tested: no overhang, partial overhang, overhang beyond keyboard height, negative overhang, non-finite input.
- `shrinkPx` cases added to the existing `viewportKeyboard.test.ts`.
- Hook test in jsdom with a stubbed `visualViewport` and a stubbed shell rect: verifies offset 0 when the bar is already above the keyboard and a positive lift when it is behind it, and that listeners are removed on unmount.

## Manual check on device

1. Open a post cold, tap the comment box on the first try — composer sits flush above the keyboard, no gap.
2. Dismiss with the keyboard-hide key, tap again — same result, tab bar returns after dismissal.
3. Rotate with the keyboard open, then re-focus — bar stays above the keyboard.
4. Desktop/≥1280px — composer stays in flow, no transform applied.
