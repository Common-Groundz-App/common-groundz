# Hide the bottom tab bar while a comment composer is focused (v3)

Both follow-up reviews are right on all counts. Folding in the breakpoint mismatch, the submit-with-retained-focus problem, instance-safe ids, and the guest-auth ordering detail.

## Why the current behaviour looks broken

`BottomNavigation` is `fixed bottom-0`. When the keyboard opens, the browser exposes a smaller visual viewport, so the tab bar lands directly above the keyboard and competes with the in-flow comment row. Three layers stack, the composer is squeezed, and a mis-tap on a tab discards what was typed. Polished social apps prioritise the active writing surface and hide the tab bar during composition.

## Approach

### 1. Router-scoped composer-activity context

New `src/contexts/ComposerFocusContext.tsx`, mounted in `App.tsx` **inside** `<Router>` (it uses `useLocation`) and around the routes:

- Holds a `Set<string>` of active composer region ids — active-source semantics, idempotent `activate(id)` / `deactivate(id)`, not a counter.
- Exposes `isComposerActive` plus the two actions.
- Clears the whole set on `location.pathname` change (defensive, so the nav can never stay hidden across navigation).

Hook `useComposerFocusRegion(id)` returns props for the **composer container**:

- `onFocusCapture` → `activate(id)`, but only when the focus target is an actual editable element inside the region, so a click on a wrapper doesn't activate.
- `onBlurCapture` → deferred check via `requestAnimationFrame`; if `document.activeElement` is still inside the container ref, stay active, otherwise `deactivate(id)`. This is what makes focus moving into the send button or reply controls a no-op.
- `useEffect` cleanup → `deactivate(id)` on unmount, which is how reply/edit rows (removed from the DOM on cancel/save) release naturally.

### 2. No viewport gate — align with the nav's own breakpoint

Dropping `useIsMobile()`: it flips at 768px while `BottomNavigation` is `xl:hidden` (1280px), which would leave 768–1279px tablets with the original awkward behaviour. The context tracks focus with no viewport logic; `BottomNavigation` alone decides, and since it is already CSS-hidden above `xl`, no extra gate is needed.

### 3. Instance-safe region ids

- main composer: `comment-main:${postId}`
- reply composer: `comment-reply:${parentCommentId}`
- edit composer: `comment-edit:${comment.id}`

No hardcoded global ids, so two concurrently mounted threads (dialog, nested surface, retained route) can't collide.

### 4. Submit keeps the composer active while the textarea stays focused

The current main submit path clears the text but does not blur. Explicitly deactivating there would pop the tab bar back above a still-open keyboard, and no new focus event would ever re-hide it. So: **no explicit deactivate on submit** — the region stays active as long as focus stays inside, which also lets the user post a second comment without reopening the keyboard. Cancel/save on reply and edit release through unmount cleanup; explicit `deactivate` is only a defensive fallback there, never a competing source of truth.

### 5. Guest auth ordering

React capture handlers run before the target's own `onFocus`, so `requireAuth()` in the existing textarea handler would fire *after* activation and leave the nav hidden behind the auth prompt. The region's focus handler therefore checks the signed-in state before activating, and the existing `requireAuth()` stays the first statement in the textarea's `onFocus` — unchanged.

### 6. Consume it in the nav

`src/components/navigation/BottomNavigation.tsx` reads `isComposerActive` and returns `null` when true — this also removes it from pointer, tab order, and the accessibility tree, unlike a visual `hidden`. The page-level `pb-[calc(4rem+...)]` in `PostView.tsx` stays, so nothing jumps.

### 7. No scroll correction in this pass

iOS already scrolls the focused input into view; an extra smooth scroll fights the keyboard animation. If real-device testing still shows clipping, we add a measurement-gated nudge (`block: 'nearest'`, after `requestAnimationFrame`) as a follow-up.

## Files touched

- `src/contexts/ComposerFocusContext.tsx` (new — provider + `useComposerFocusRegion`)
- `src/App.tsx` (mount provider inside `<Router>`)
- `src/components/comments/InlineCommentThread.tsx` (wire main / reply / edit regions)
- `src/components/comments/CommentItem.tsx` (accept region props for the edit row)
- `src/components/navigation/BottomNavigation.tsx` (return `null` while active)
- Unit tests for the context: overlapping regions, idempotent activate/deactivate, route reset, unmount cleanup.

## Explicitly unchanged

Viewport meta, the 16px mobile textarea font fix, comment behaviour, mention autocomplete, layout widths, and padding.

## Verification (physical iOS/iPadOS, Safari + Chrome)

1. Tap the main comment box → tab bar disappears; composer visible above keyboard.
2. Dismiss keyboard / tap elsewhere → tab bar returns.
3. Submit a comment with focus retained → tab bar stays hidden, keyboard stays open, typing again works; dismissing the keyboard restores the nav.
4. Reply composer and a comment's Edit composer → tab bar hides in both; cancel restores it.
5. Move between main / reply / edit regions → no flicker.
6. Type `@` → autocomplete opens and selecting a name does not restore the tab bar.
7. Guest tap on the composer → auth prompt appears and the tab bar is never hidden.
8. Navigate to Home while a composer was focused → tab bar present on the new page.
9. iPad at ~1024px width → same suppression as phone (this is the breakpoint fix).
10. Desktop above `xl` → no change.
