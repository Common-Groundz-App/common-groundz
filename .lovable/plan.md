# Dock the comment composer to the keyboard, Facebook-style

## What's wrong today

The tab bar now hides while typing (previous phase), but the composer itself is still a normal in-flow block at the end of the comments list. When iOS opens the keyboard it shrinks the *visual* viewport without changing layout, so the page keeps its full height and the composer stays wherever the document put it — leaving the large blank gap between the input and the keyboard seen in IMG_2896.

Facebook has no gap because its composer is pinned to the bottom edge of the visual viewport: it rides up with the keyboard and sits flush against it.

## Approach

### 1. A small visual-viewport hook

New `src/hooks/useKeyboardInset.ts`:

- Subscribes to `window.visualViewport` `resize` + `scroll` (with a `requestAnimationFrame` guard so we update at most once per frame).
- Returns `keyboardInset` = `max(0, layoutViewportHeight - (visualViewport.height + visualViewport.offsetTop))` — the number of px the keyboard (plus any accessory bar) covers.
- Returns `0` when `visualViewport` is unsupported, so non-iOS and desktop behaviour is unchanged.

### 2. Dock the main composer while it is focused

In `src/components/comments/InlineCommentThread.tsx`, the main composer wrapper (currently `border-t border-border mt-4 pt-4`) becomes conditionally docked:

- Docked only when the main region is the active composer region *and* `keyboardInset > 0` — so it never floats on desktop or when the keyboard isn't up.
- Docked styles: `fixed left-0 right-0 z-50 bg-background border-t px-4 py-2`, with inline `bottom: keyboardInset` so it sits exactly on top of the keyboard. It stays visually flush as the inset changes (predictive-text bar toggling, keyboard switching).
- Class-only `xl:static` reset is not enough on its own, so the docked branch also requires the keyboard inset, which desktop never has.
- While docked, a spacer div of the composer's measured height is left in the flow so the comment list above does not jump when the composer detaches.

### 3. Keep the composer visible on the way in

After activation, one `requestAnimationFrame`-deferred `scrollIntoView({ block: 'nearest' })` on the last comment row so the newest content isn't hidden behind the now-docked bar. No smooth scroll — it would fight the keyboard animation.

### 4. Reply and edit composers

Left in flow, unchanged. They live inline next to the comment being answered, and docking them would detach them from their context (Facebook does the same). They already benefit from the hidden tab bar.

## Technical notes

- The existing `ComposerFocusContext` already tells us when the main region holds focus; `useComposerFocusRegion` gains no new responsibilities — the component reads `isComposerActive` for its own region via a small local `isActive` state set in the same focus/blur handlers, so docking never triggers on a *different* thread instance.
- `PostView.tsx`'s bottom padding stays as-is; while docked the tab bar is hidden and the docked bar occupies that band.
- Purely presentational: no changes to comment submission, mentions, auth gating, or data flow.

## Files touched

- `src/hooks/useKeyboardInset.ts` (new)
- `src/components/comments/InlineCommentThread.tsx` (conditional docking + spacer)

## Verification (physical iOS)

1. Tap the comment box → composer sits flush above the keyboard, no white gap, tab bar hidden.
2. Type multiple lines → composer grows upward, stays flush.
3. Toggle the predictive-text bar → composer re-seats with no gap.
4. Submit → keyboard stays, composer stays docked, list updates above.
5. Blur → composer returns to its in-flow position with no layout jump; tab bar returns.
6. Reply and edit rows → unchanged inline behaviour.
7. Desktop and iPad landscape → no docking, no visual change.
