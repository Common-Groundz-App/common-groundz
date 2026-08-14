# Dock the composer to the visual viewport, not to `bottom: 0`

## Why the keyboard-hide button works and tapping the screen doesn't

Both paths end with the keyboard closed, but they leave the page in different scroll states.

- Keyboard-hide button: our dismissal hook blurs the composer, the region deactivates, the composer returns to flow, and the browser restores its normal scroll offset. The next focus starts from a settled viewport, so `fixed bottom-0` happens to line up.
- Tapping the screen: the tap blurs the textarea but iOS/Chrome keeps the page scrolled up (`visualViewport.offsetTop` stays non-zero). On the next focus the composer docks with `bottom: 0`, which is measured against the *layout* viewport — so it lands under the keyboard, exactly the state in the screenshot.

So Stage 1 (dock only when the keyboard is confirmed open) was necessary but not sufficient: the timing is right now, the *anchor* is wrong. Static `bottom: 0` can never be correct while the layout and visual viewports are desynced.

## What to do instead of Stage 2's transform system

Take Gemini's Fix 2 — the same idea as v4 but without measurement, reconstruction, or convergence sampling. Bind the docked composer's `bottom` to the live keyboard inset:

```text
inset = max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
```

That value is the height of whatever is covering the bottom of the layout viewport (the keyboard). Applying it as an inline `bottom` keeps the bar glued above the keyboard regardless of what the page's scroll offset happens to be, on first focus and every focus after.

We do **not** implement `dockOffset.ts`, `useDockedComposerOffset.ts`, `translate3d` correction, `shrinkPx`-based positioning, or the 250ms follow-up sampling.

### Implementation

- New `src/utils/keyboardInset.ts` — pure `computeKeyboardInset({ innerHeight, visualHeight, visualOffsetTop, scale })`:
  - returns `0` when zoomed (`scale > 1.01`), when any input is non-finite, or when the computed value is negative or absurd (clamped to `innerHeight * 0.6`);
  - otherwise the rounded inset.
- New `src/hooks/useKeyboardInset.ts` — subscribes to `visualViewport` `resize` + `scroll` and `window` `resize`, coalesced with `requestAnimationFrame`, returns the inset. Only active while the composer is docked (guarded by an `enabled` flag) so nothing runs on desktop or in flow.
- `src/components/comments/InlineCommentThread.tsx`:
  - keep `shouldDockMainComposer` and the spacer exactly as shipped;
  - keep the `fixed inset-x-0 z-50` classes but drop `bottom-0` in favour of `style={{ bottom: keyboardInset }}` while docked;
  - safe-area padding rule stays as-is.

Reply and edit composers, docking geometry width, mention popover tiering, the dismissal-blur hook, and the 1280px breakpoint are all unchanged.

### Not doing

- `interactive-widget=resizes-content` in the viewport meta: it is a global change affecting every page and is ignored by iOS Safari/Chrome, which is the platform in question.
- `scrollIntoView` on focus: a timeout-based scroll fights the docking model and reintroduces the race we just removed.

## Tests

- `keyboardInset.test.ts` — normal keyboard inset; zero when the viewport matches `innerHeight`; zero when zoomed; zero for invalid numbers; negative clamped to zero; oversized clamped.
- `useKeyboardInset.test.tsx` — updates on `visualViewport` resize and scroll, coalesces multiple events into one frame, returns 0 and subscribes to nothing when disabled, removes every listener on unmount.
- Docking-condition suite stays unchanged.

## Device verification (iOS Chrome and Safari)

1. Cold-open a post, tap the input once — bar lands flush above the keyboard.
2. Tap elsewhere to dismiss, tap the input again — still flush (this is the failing case today).
3. Dismiss with the keyboard-hide key, tap again — still flush; bottom nav returns on dismissal.
4. Type several lines — bar tracks the keyboard, spacer keeps pace.
5. Scroll the page while the keyboard is open — bar stays glued.
6. Rotate with the keyboard open — bar re-anchors, no stray gap.
7. Pinch-zoom while focused — no misplacement (inset falls back to 0).
8. Desktop / >=1280px — composer stays in flow, unchanged.
