# Dock the comment composer to the keyboard, Facebook-style (v2)

Both reviews are right, and one of their points is already settled by evidence we have: in your earlier screenshot (IMG_2894) `BottomNavigation` — a plain `fixed bottom-0` element — floated *directly above* the open keyboard. That proves fixed positioning on your browser is already visual-viewport relative. So `bottom: keyboardInset` would double-count by a full keyboard height. Dropping it.

## Goal

While the authenticated main comment composer is focused on phone/tablet widths, it docks flush above the keyboard with no white gap. The tab bar stays hidden (already shipped). Reply and edit composers stay inline.

## Approach

### 1. Measure before building anything

First pass is a measurement pass, not a styling pass. On physical iOS Safari and Chrome, with the composer focused, capture:

- `window.innerHeight`, `visualViewport.height`, `visualViewport.offsetTop`
- `getBoundingClientRect()` of the composer wrapper and of the (hidden) nav slot
- current `window.scrollY` and the document height below the composer

This tells us (a) whether `fixed bottom-0` really lands on the keyboard edge and (b) whether the blank band is the in-flow composer, the empty-state height, `PostView`'s `pb-[calc(4rem+...)]`, or scroll position. The docking code only lands after the numbers confirm the cause. Exposed behind a temporary debug readout, removed before merge.

### 2. Per-region focus state from the existing context — no second state machine

`ComposerFocusContext` already owns editable-target filtering, `enabled` guest gating, deferred containment checks, unmount cleanup and instance-safe ids. Rather than duplicating that with a local `isActive`, `useComposerFocusRegion` gains one return field:

- `isActive: boolean` — true when *this* region id is in the provider's active set.

That is a natural extension of its focus-state contract and keeps a single source of truth. `InlineCommentThread` reads `mainRegion.isActive`.

### 3. Dock with `fixed bottom-0`, no viewport math

When `mainRegion.isActive` and the viewport is below `xl` (parity with the nav's own breakpoint):

- Wrapper becomes `fixed inset-x-0 bottom-0 z-50 bg-background border-t`.
- Inner content keeps the existing `max-w-2xl mx-auto px-4` alignment so it stays column-aligned with the post rather than stretching edge-to-edge on tablets.
- `z-50` sits at the documented base tier, below dialogs (101) and the auth overlay (109).

No `useKeyboardInset`, no `visualViewport` subscription in the shipped code. If — and only if — step 1 shows `bottom-0` sitting *behind* the keyboard on some browser, we add a lifecycle-safe hook as a corrective delta, with: synchronous initial measurement, `resize` + `scroll` + `orientationchange` listeners, listener removal and `cancelAnimationFrame` on cleanup, a mounted guard against stale callbacks, and rounded (not subpixel) values.

### 4. Safe area only when the keyboard is not covering it

`pb-[env(safe-area-inset-bottom)]` is correct when docked without a keyboard, but adds a visible gap when the keyboard already covers the home indicator. So the docked wrapper uses safe-area padding only while not active-with-keyboard; when docking is triggered by focus, padding is plain `py-2`. If step 1 shows a case where docking happens with no keyboard (hardware keyboard, iPad Magic Keyboard), we keep safe-area padding for that case specifically.

### 5. ResizeObserver-synchronized spacer

A `ResizeObserver` on the composer wrapper records its height continuously. While docked, a spacer div of exactly that height holds the original slot in flow, so:

- multi-line growth while docked does not obscure the last comment,
- returning to flow on blur causes no jump.

### 6. No automatic comment-list scrolling

Dropped from v1. A fixed composer is already visible; "scroll the last row" is unreliable (relevance sort, replies as the final row, post-submit reload) and fights iOS's own focus scroll. The synchronized spacer handles the real concern — content being covered. Revisit only if measurement shows a specific obscured target.

### 7. Considered and rejected: `position: sticky; bottom-0`

Simpler (stays in flow, no spacer, inherits width), but it only pins while its scroll container extends past the viewport — which fails exactly in the empty-comments case from your screenshot. Fixed + spacer it is.

## Technical notes

- Purely presentational: no changes to submission, mentions, auth gating, or data flow.
- `PostView.tsx`'s bottom padding stays; the hidden nav's band is what the docked bar occupies. If step 1 shows that padding contributing to the blank band, it becomes a separate one-line conditional rather than part of the docking change.
- Guests never dock: `enabled: Boolean(user)` already prevents activation, and the existing `onFocus` blur-and-prompt path is untouched.

## Files touched

- `src/contexts/ComposerFocusContext.tsx` (expose `isActive` per region)
- `src/components/comments/InlineCommentThread.tsx` (docked wrapper + ResizeObserver spacer)
- `src/contexts/ComposerFocusContext.test.tsx` (cover `isActive` for active / inactive / disabled / two instances)

## Verification (physical iOS Safari + Chrome)

1. Measurement readout confirms the gap source and that `bottom-0` lands on the keyboard edge.
2. Tap the main comment box → composer flush above keyboard, no white gap, tab bar hidden.
3. Multi-line comment → grows upward, stays flush, spacer keeps last comment visible.
4. Predictive-text bar on/off and keyboard switch → stays flush.
5. Submit with focus retained → stays docked, list updates above.
6. Blur → returns in flow with no jump; tab bar returns.
7. Reply and edit composers → unchanged inline behaviour.
8. iPad ~1024px → docked bar stays column-aligned, not edge-to-edge.
9. Desktop above `xl` → no docking, no visual change.
